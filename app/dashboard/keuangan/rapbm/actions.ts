'use server'

import { checkKomiteWrite } from '@/lib/komite-funds'
import { invalidateFinanceCache } from '@/lib/finance-cache'
import { revalidatePath } from 'next/cache'
import initialSource from '@/data/rapbm-2026-source.json'
import { importRapbm, publishRapbm } from '@/lib/rapbm-service'
import { RapbmAccessError, requireRapbmAccess } from '@/lib/rapbm-access'
import { RapbmValidationError, type RapbmActionResult } from '@/lib/rapbm'

function failure(error: unknown): RapbmActionResult {
  if (error instanceof RapbmAccessError || error instanceof RapbmValidationError) return {error:error.message}
  console.error('Penyimpanan RAPBM gagal',error)
  return {error:'RAPBM belum dapat disimpan. Muat ulang halaman dan periksa apakah draft atau penerbitan sudah tersimpan sebelum mencoba lagi.'}
}

export async function importRapbmAction(formData: FormData): Promise<RapbmActionResult> {
  try {
    const context=await requireRapbmAccess('create')
    const file=formData.get('file')
    if (!(file instanceof File)) throw new RapbmValidationError('Pilih file RAPBM berformat .xlsx.')
    const result=await importRapbm(file,context,Number(formData.get('cohort')))
    revalidatePath('/dashboard/keuangan/rapbm')
    return {...result,success:'Draft RAPBM tersimpan. Periksa rincian dan Catatan Angka sebelum menerbitkan.'}
  } catch(error) { return failure(error) }
}

export async function importInitialRapbmAction(): Promise<RapbmActionResult> {
  try {
    const context=await requireRapbmAccess('create')
    const bytes=Uint8Array.from(atob(initialSource.base64),char=>char.charCodeAt(0))
    const result=await importRapbm(new File([bytes],initialSource.filename,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),context,2026)
    revalidatePath('/dashboard/keuangan/rapbm')
    return {...result,success:'Draft RAPBM 2026 siap diperiksa.'}
  } catch(error) { return failure(error) }
}

export async function publishRapbmAction(id: string, revision: number, acknowledged: boolean): Promise<RapbmActionResult> {
  try {
    const context=await requireRapbmAccess('update')
    const result=await publishRapbm(id,revision,acknowledged,context)
    revalidatePath('/dashboard/keuangan/rapbm')
    return {...result,success:'RAPBM berhasil diterbitkan. Versi sebelumnya tetap tersedia sebagai arsip.'}
  } catch(error) { return failure(error) }
}

export async function configureKomiteRapbm(formData: FormData) {
  const {db,user}=await requireRapbmAccess('update')
  const id=String(formData.get('version') || '')
  const cohort=Number(formData.get('cohort'))
  const priorId=String(formData.get('prior_version') ?? '')
  const priorSnapshot=String(formData.get('prior_snapshot') ?? '')
  const reason=String(formData.get('revision_reason') || '').trim().slice(0,300)
  if (!Number.isInteger(cohort)||cohort<2026||cohort>2199) return {error:'Pilih angkatan mulai 2026.'}
  const [groups, prior, version] = await Promise.all([
    db.prepare(`SELECT g.id,g.komite,COALESCE(SUM(i.komite),0) detail FROM fin_rapbm_groups g
      LEFT JOIN fin_rapbm_items i ON i.group_id=g.id WHERE g.section='expense' AND g.version_id=? GROUP BY g.id`).bind(id).all<{id:string;komite:number|null;detail:number}>(),
    db.prepare(`SELECT b.version_id,b.available, (SELECT SUM(p.available) FROM fin_komite_budget_balances p WHERE p.version_id=b.version_id) direct
      FROM fin_komite_revision_balance b WHERE b.cohort=?`).bind(cohort).first<{version_id:string;available:number;direct:number}>(),
    db.prepare(`SELECT v.status,v.komite_cohort AS cohort FROM fin_rapbm_versions v WHERE v.id=?`).bind(id).first<{status:string;cohort:number|null}>(),
  ])
  if (!version || version.status==='draft' || (version.cohort!==null && version.cohort!==cohort) || !groups.results.length) return {error:'Terbitkan versi Excel dan pastikan angkatan sesuai.'}
  const positions=groups.results.map(group=>({
    ...group,
    amount:!String(formData.get(`pagu:${group.id}`) ?? '').trim() ? NaN : Number(formData.get(`pagu:${group.id}`)),
    note:String(formData.get(`alasan:${group.id}`) ?? '').trim().slice(0,300),
  }))
  const total=positions.reduce((sum,row)=>sum+row.amount,0)
  if (!Number.isSafeInteger(total) || positions.some(row=>!Number.isSafeInteger(row.amount)||row.amount<0)) return {error:'Isi semua pagu dengan bilangan rupiah yang valid.'}
  if (positions.some(row=>(row.amount!==(row.komite??0)||row.amount!==row.detail)&&row.note.length<3)) return {error:'Jelaskan selisih pagu setiap pos yang berbeda dari Excel.'}
  if ((prior?.version_id ?? '')!==priorId || (prior && priorSnapshot!==String(prior.available))) return {error:'Sisa pagu sudah berubah. Muat ulang dan tinjau selisihnya.'}
  if (prior && prior.available!==total && reason.length<3) return {error:'Isi alasan perubahan total pagu.'}
  try {
    await db.batch([
      db.prepare(`INSERT INTO fin_komite_rapbm_versions
        (version_id,cohort,previous_version_id,activated_by,prior_unspent,carry_forward,revision_reason,enabled)
        SELECT ?,?,?,?,?,?,?,? WHERE
        (? IS NULL AND NOT EXISTS(SELECT 1 FROM fin_komite_rapbm_versions WHERE cohort=?))
        OR EXISTS(SELECT 1 FROM fin_komite_revision_balance b WHERE b.version_id=? AND b.available=?
          AND (SELECT SUM(p.available) FROM fin_komite_budget_balances p WHERE p.version_id=b.version_id)=?)`)
        .bind(id,cohort,prior?.version_id??null,user.id,prior?.direct??0,prior?.available??0,reason||null,prior?1:0,
          prior?.version_id??null,cohort,prior?.version_id??null,prior?.available??0,prior?.direct??0),
      checkKomiteWrite(db),
      ...positions.map(row=>db.prepare('INSERT INTO fin_komite_budget_positions(group_id,amount,reason) VALUES(?,?,?)').bind(row.id,row.amount,row.note||null)),
    ])
  } catch { return {error:'Pagu atau versi sudah berubah. Muat ulang RAPBM dan periksa kembali.'} }
  invalidateFinanceCache()
  revalidatePath('/dashboard/keuangan/rapbm')
  return {success:prior?'Revisi pagu aktif.':'Pagu siap dipakai untuk pemetaan historis.'}
}

export async function activateKomiteRapbm(id:string, reconciled:boolean) {
  const {db,user}=await requireRapbmAccess('update')
  if (reconciled!==true) return {error:'Konfirmasi hasil rekonsiliasi terlebih dahulu.'}
  const version=await db.prepare('SELECT cohort FROM fin_komite_rapbm_versions WHERE version_id=? AND enabled=0').bind(id).first<{cohort:number}>()
  if (!version) return {error:'RAPBM menunggu aktivasi tidak ditemukan.'}
  try {
    await db.batch([
      db.prepare(`UPDATE fin_komite_rapbm_versions SET enabled=1,activated_by=?,activated_at=datetime('now') WHERE version_id=? AND enabled=0
        AND NOT EXISTS(SELECT 1 FROM komite_pengajuan p WHERE p.status='disetujui' AND p.komite_cancelled_at IS NULL
          AND NOT EXISTS(SELECT 1 FROM fin_komite_allocations a WHERE a.pengajuan_id=p.id AND a.state IN ('locked','realized')))
        AND NOT EXISTS(SELECT 1 FROM fin_cashflow_entries e WHERE e.is_void=0 AND e.direction='expense'
          AND NOT EXISTS(SELECT 1 FROM fin_komite_cash_parts part WHERE part.id=e.id AND part.source<>'unmapped'))`).bind(user.id,id),
      checkKomiteWrite(db),
      db.prepare(`UPDATE komite_pengajuan SET status='menunggu_bendahara',fund_review_cycle=fund_review_cycle+1,updated_at=datetime('now')
        WHERE status='menunggu_ketua' AND NOT EXISTS(SELECT 1 FROM fin_komite_allocations a WHERE a.pengajuan_id=komite_pengajuan.id AND a.state='review')`),
    ])
  } catch { return {error:'Selesaikan pemetaan pengeluaran dan SPB historis terlebih dahulu.'} }
  invalidateFinanceCache()
  revalidatePath('/dashboard/keuangan/rapbm')
  return {success:`Kontrol RAPBM Angkatan ${version.cohort} aktif.`}
}
