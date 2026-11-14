import { ensureActivityLogTables } from '@/lib/activity-log'
import { RapbmAccessError, requireRapbmAccess } from './rapbm-access'
import { parseRapbm } from './rapbm-parser'
import { putRapbmSource, removeUncommittedRapbmSource } from './rapbm-storage'
import { RAPBM_MAX_BYTES, RapbmValidationError } from './rapbm'
import type { RapbmAmounts, RapbmDocument, RapbmGroup, RapbmItem, RapbmPageData, RapbmVersion } from './rapbm'

type VersionRow = RapbmVersion & {
  title: string; institution: string; sheet: string
  income_totals_json: string; expense_totals_json: string; notes_json: string
}
type GroupRow = { id: string; section: 'income' | 'expense'; sort_order: number; label: string; account: string | null; source_ref: string; subtotal_ref: string | null } & RapbmAmounts
type ItemRow = { group_id: string; sort_order: number; description: string; account: string | null; volume: string | null; unit: string | null; source_ref: string } & RapbmAmounts

function publicVersion(row: VersionRow): RapbmVersion {
  return { id:row.id,year:row.year,version:row.version,status:row.status,original_filename:row.original_filename,
    created_at:row.created_at,created_by_name:row.created_by_name,published_at:row.published_at,note_count:row.note_count }
}

export async function getRapbmPageData(year?: number, versionId?: string): Promise<RapbmPageData> {
  const {db,canManage}=await requireRapbmAccess()
  const rows=await db.prepare(`SELECT v.*,json_array_length(notes_json) AS note_count FROM fin_rapbm_versions v
    WHERE (?=1 OR status<>'draft') ORDER BY year DESC,version DESC`).bind(canManage?1:0).all<VersionRow>()
  const versions=rows.results || []
  const selectedYear=Number.isInteger(year) ? year : versions[0]?.year
  const inYear=versions.filter(v=>v.year===selectedYear)
  const selected=versionId ? inYear.find(v=>v.id===versionId) : inYear.find(v=>v.status==='published') || inYear[0]
  if (!selected) return {versions:versions.map(publicVersion),selected:null,document:null,canManage,publicationRevision:0}
  const [groups,items,publication]=await Promise.all([
    db.prepare('SELECT * FROM fin_rapbm_groups WHERE version_id=? ORDER BY section,sort_order').bind(selected.id).all<GroupRow>(),
    db.prepare(`SELECT i.* FROM fin_rapbm_items i JOIN fin_rapbm_groups g ON g.id=i.group_id
      WHERE g.version_id=? ORDER BY i.sort_order`).bind(selected.id).all<ItemRow>(),
    db.prepare('SELECT publication_revision FROM fin_rapbm_years WHERE year=?').bind(selected.year).first<{publication_revision:number}>(),
  ])
  const mapped=(groups.results || []).map(g => ({ section:g.section,group:{ order:g.sort_order,label:g.label,account:g.account,
    reference:g.source_ref,subtotalReference:g.subtotal_ref,amounts:{apbn:g.apbn,komite:g.komite,total:g.total},
    items:(items.results || []).filter(i=>i.group_id===g.id).map(i=>({order:i.sort_order,description:i.description,account:i.account,volume:i.volume,unit:i.unit,reference:i.source_ref,amounts:{apbn:i.apbn,komite:i.komite,total:i.total}} satisfies RapbmItem)),
  } satisfies RapbmGroup }))
  return { versions:versions.map(publicVersion),selected:publicVersion(selected),canManage,publicationRevision:publication?.publication_revision || 0,
    document:{year:selected.year,title:selected.title,institution:selected.institution,sheet:selected.sheet,
      incomeTotal:JSON.parse(selected.income_totals_json),expenseTotal:JSON.parse(selected.expense_totals_json),notes:JSON.parse(selected.notes_json),
      income:mapped.filter(g=>g.section==='income').map(g=>g.group),expenses:mapped.filter(g=>g.section==='expense').map(g=>g.group)} }
}

function bulkInsert(db: D1Database, table: string, columns: string[], rows: (string|number|null)[][]) {
  const statements: D1PreparedStatement[]=[]
  // Keep each statement well below D1's parameter limit, while preserving one
  // atomic batch for the complete import (including its audit record).
  for (let start=0;start<rows.length;start+=4) {
    const chunk=rows.slice(start,start+4)
    statements.push(db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES ${chunk.map(()=>`(${columns.map(()=>'?').join(',')})`).join(',')}`).bind(...chunk.flat()))
  }
  return statements
}

// Context is supplied only by guarded server callers; never by a request payload.
export async function importRapbm(file: File, context?: Awaited<ReturnType<typeof requireRapbmAccess>>, cohort?: number) {
  const access=context || await requireRapbmAccess('create')
  if (!access.canManage) throw new RapbmAccessError(403)
  const {db,user,roles}=access
  if (!(file instanceof File) || !/\.xlsx$/i.test(file.name)) throw new RapbmValidationError('Pilih file RAPBM berformat .xlsx.')
  if (file.size>RAPBM_MAX_BYTES) throw new RapbmValidationError('Ukuran Excel maksimal 6 MB.')
  const bytes=new Uint8Array(await file.arrayBuffer())
  const document=parseRapbm(bytes)
  if (cohort !== undefined && (!Number.isInteger(cohort)||cohort<2026||cohort>2199)) throw new RapbmValidationError('Angkatan RAPBM tidak valid.')
  const id=crypto.randomUUID()
  const key=`private/rapbm/${document.year}/${id}.xlsx`
  const filename=file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,180)
  const actor=user.nama_lengkap || user.name || user.id
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))
  const sha=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')
  await ensureActivityLogTables(db)
  const groupRows:(string|number|null)[][]=[],itemRows:(string|number|null)[][]=[]
  for (const section of ['income','expense'] as const) {
    for (const group of section==='income'?document.income:document.expenses) {
      const groupId=crypto.randomUUID()
      groupRows.push([groupId,id,section,group.order,group.label,group.account,group.reference,group.subtotalReference,group.amounts.apbn,group.amounts.komite,group.amounts.total])
      for (const item of group.items) itemRows.push([crypto.randomUUID(),groupId,item.order,item.description,item.account,item.volume,item.unit,item.reference,item.amounts.apbn,item.amounts.komite,item.amounts.total])
    }
  }
  try {
    await putRapbmSource(key,bytes)
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO fin_rapbm_years (year) VALUES (?)').bind(document.year),
      db.prepare(`INSERT INTO fin_rapbm_versions (id,year,version,title,institution,sheet,income_totals_json,expense_totals_json,notes_json,original_filename,r2_key,source_sha256,created_by,created_by_name${cohort===undefined ? '' : ',komite_cohort'})
        SELECT ?,?,COALESCE(MAX(version),0)+1,?,?,?,?,?,?,?,?,?,?,?${cohort===undefined ? '' : ',?'} FROM fin_rapbm_versions WHERE year=?`)
        .bind(id,document.year,document.title,document.institution,document.sheet,JSON.stringify(document.incomeTotal),JSON.stringify(document.expenseTotal),JSON.stringify(document.notes),filename,key,sha,user.id,actor,...(cohort===undefined ? [] : [cohort]),document.year),
      ...bulkInsert(db,'fin_rapbm_groups',['id','version_id','section','sort_order','label','account','source_ref','subtotal_ref','apbn','komite','total'],groupRows),
      ...bulkInsert(db,'fin_rapbm_items',['id','group_id','sort_order','description','account','volume','unit','source_ref','apbn','komite','total'],itemRows),
      db.prepare(`INSERT INTO activity_logs (id,actor_user_id,actor_name,actor_roles,module,action,summary,entity_type,entity_id,metadata_json)
        VALUES (?,?,?,?,'rapbm','import','Mengimpor RAPBM sebagai draft','rapbm_version',?,?)`)
        .bind(crypto.randomUUID(),user.id,actor,JSON.stringify(roles),id,JSON.stringify({year:document.year,filename,sha256:sha,noteCount:document.notes.length})),
    ])
  } catch (error) {
    // A transport error may occur after a committed batch. Never remove its
    // source unless the database confirms that this version does not exist.
    try {
      const committed=await db.prepare('SELECT id FROM fin_rapbm_versions WHERE id=?').bind(id).first()
      if (committed) return {id,year:document.year}
      await removeUncommittedRapbmSource(key)
    } catch (cleanupError) { console.error('RAPBM: sumber impor belum dapat dipastikan',cleanupError) }
    throw error
  }
  return {id,year:document.year}
}

export async function publishRapbm(id: string, revision: number, acknowledged: boolean, context?: Awaited<ReturnType<typeof requireRapbmAccess>>) {
  const access=context || await requireRapbmAccess('update')
  if (!access.canManage) throw new RapbmAccessError(403)
  const {db,user,roles}=access
  if (typeof id!=='string' || !Number.isSafeInteger(revision) || revision<0 || typeof acknowledged!=='boolean') throw new RapbmValidationError('Permintaan penerbitan tidak valid.')
  const row=await db.prepare('SELECT * FROM fin_rapbm_versions WHERE id=?').bind(id).first<{id:string;year:number;status:string;notes_json:string;komite_cohort?:number|null}>()
  if (!row || row.status!=='draft') throw new RapbmValidationError('Pilih draft RAPBM yang belum diterbitkan.')
  const notes=JSON.parse(row.notes_json) as RapbmDocument['notes']
  if (notes.length && !acknowledged) throw new RapbmValidationError('Baca dan akui Catatan Angka sebelum menerbitkan sesuai dokumen sumber.')
  await ensureActivityLogTables(db)
  const logId=crypto.randomUUID()
  const cohortScoped = Object.hasOwn(row,'komite_cohort')
  const results=await db.batch([
    db.prepare(`INSERT INTO activity_logs (id,actor_user_id,actor_name,actor_roles,module,action,summary,entity_type,entity_id,before_json,metadata_json)
      SELECT ?,?,?,?,'rapbm','publish','Menerbitkan versi RAPBM','rapbm_version',?,
        json_object('active_version_id',active_version_id,'publication_revision',publication_revision),?
      FROM fin_rapbm_years WHERE year=? AND publication_revision=?
        AND EXISTS (SELECT 1 FROM fin_rapbm_versions WHERE id=? AND status='draft')`)
      .bind(logId,user.id,user.nama_lengkap || user.name || user.id,JSON.stringify(roles),id,JSON.stringify({notesAcknowledged:acknowledged,noteCount:notes.length}),row.year,revision,id),
    db.prepare(`UPDATE fin_rapbm_versions SET status='superseded' WHERE year=? AND status='published' AND EXISTS (SELECT 1 FROM activity_logs WHERE id=?) ${cohortScoped ? 'AND komite_cohort IS ?' : ''}`).bind(row.year,logId,...(cohortScoped ? [row.komite_cohort ?? null] : [])),
    db.prepare(`UPDATE fin_rapbm_versions SET status='published',published_at=datetime('now'),published_by=?,notes_acknowledged=?
      WHERE id=? AND status='draft' AND EXISTS (SELECT 1 FROM activity_logs WHERE id=?)`).bind(user.id,acknowledged?1:0,id,logId),
    db.prepare(`UPDATE fin_rapbm_years SET active_version_id=?,publication_revision=publication_revision+1
      WHERE year=? AND publication_revision=? AND EXISTS (SELECT 1 FROM activity_logs WHERE id=?)`).bind(id,row.year,revision,logId),
  ])
  if (!results[2].meta.changes || !results[3].meta.changes) throw new RapbmValidationError('Versi terbit sudah berubah. Muat ulang dan periksa kembali sebelum menerbitkan.')
  return {id,year:row.year}
}
