import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import source from '@/data/rapbm-2026-source.json'
import { RAPBM_SCHEMA } from './rapbm-schema'
import { getRapbmPageData, importRapbm, publishRapbm } from './rapbm-service'

const state=vi.hoisted(()=>({db:null as unknown as D1Database,canManage:true,failSql:'',lostResponse:false,
  put:vi.fn(),remove:vi.fn(),objects:new Map<string,Uint8Array>()}))
vi.mock('./rapbm-access',()=>({RapbmAccessError:class extends Error{constructor(public status:number){super('Forbidden')}},requireRapbmAccess:async(action='read')=>{
  if (!state.canManage&&action!=='read') throw new Error('Forbidden')
  return {db:state.db,user:{id:'manager',name:'Bendahara'},roles:state.canManage?['bendahara_komite']:['kepsek'],canManage:state.canManage}
}}))
vi.mock('./rapbm-storage',()=>({putRapbmSource:state.put,removeUncommittedRapbmSource:state.remove}))
vi.mock('@/lib/activity-log',()=>({ensureActivityLogTables:async()=>undefined}))
let sqlite: DatabaseSync
beforeEach(()=>{
  state.canManage=true;state.failSql='';state.lostResponse=false;state.objects.clear()
  state.put.mockReset().mockImplementation(async(key,bytes)=>{state.objects.set(key,bytes)})
  state.remove.mockReset().mockImplementation(async key=>{state.objects.delete(key)})
  sqlite=new DatabaseSync(':memory:')
  sqlite.exec(`PRAGMA foreign_keys=ON;CREATE TABLE "user" (id TEXT PRIMARY KEY);INSERT INTO "user" VALUES ('manager');
    CREATE TABLE activity_logs (id TEXT PRIMARY KEY,actor_user_id TEXT,actor_name TEXT,actor_roles TEXT,module TEXT,action TEXT,summary TEXT,entity_type TEXT,entity_id TEXT,before_json TEXT,metadata_json TEXT);`)
  for (const sql of RAPBM_SCHEMA) sqlite.exec(sql)
  state.db={prepare(sql:string){
    let args:(string|number|null)[]=[]
    return {bind(...values:typeof args){args=values;return this},
      async first(){return sqlite.prepare(sql).get(...args)||null},
      async all(){return {results:sqlite.prepare(sql).all(...args)}},
      async run(){
        if (state.failSql&&sql.includes(state.failSql)) throw new Error('write failure')
        return {meta:{changes:sqlite.prepare(sql).run(...args).changes}}
      },
    }
  },async batch(statements:{run():Promise<unknown>}[]){
    sqlite.exec('BEGIN')
    let committed=false
    try {const results=[];for(const stmt of statements)results.push(await stmt.run());sqlite.exec('COMMIT');committed=true
      if(state.lostResponse){state.lostResponse=false;throw new Error('transport failure after commit')}return results
    } catch(error){if(!committed)sqlite.exec('ROLLBACK');throw error}
  }} as unknown as D1Database
})
afterEach(()=>sqlite.close())
const file=()=>new File([new Uint8Array(Buffer.from(source.base64,'base64'))],source.filename)
const row=(id:string)=>sqlite.prepare('SELECT * FROM fin_rapbm_versions WHERE id=?').get(id)!
const count=(table:string)=>sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n

describe('RAPBM archive and publication',()=>{
  it('persists an immutable draft with its source, exact details, notes and import audit',async()=>{
    const imported=await importRapbm(file())
    const data=await getRapbmPageData(2026,imported.id)
    expect(data.document?.expenses).toHaveLength(17)
    expect(data.document?.expenses.flatMap(g=>g.items)).toHaveLength(105)
    expect(data.selected).toMatchObject({status:'draft',version:1,year:2026})
    expect(state.objects.get(String(row(imported.id).r2_key))).toEqual(new Uint8Array(Buffer.from(source.base64,'base64')))
    expect(count('activity_logs')).toBe(1)
    expect(data.document?.notes.some(n=>n.reference==='RAPBM 2026!J66')).toBe(true)
    expect(data.document?.expenses.flatMap(g=>g.items).find(i=>i.reference==='RAPBM 2026!E124:J124')?.amounts.total).toBeNull()
  })
  it('publishes independent cohorts with the same fiscal year',async()=>{
    sqlite.exec(`CREATE TABLE komite_pengajuan(id TEXT PRIMARY KEY,status TEXT,nominal INTEGER);
      CREATE TABLE komite_pengajuan_reviews(pengajuan_id TEXT,version_number INTEGER,stage TEXT,workflow_version INTEGER);
      CREATE TABLE fin_cashflow_entries(id TEXT PRIMARY KEY,is_void INTEGER);
      CREATE TABLE fin_cashflow_categories(id TEXT PRIMARY KEY,direction TEXT,name TEXT,sort_order INTEGER,is_system INTEGER);`)
    sqlite.exec(readFileSync(new URL('../migrations/0127_komite_fund_sources.sql',import.meta.url),'utf8'))
    const one=await importRapbm(file(),undefined,2026)
    const two=await importRapbm(file(),undefined,2027)
    await publishRapbm(one.id,0,true)
    await publishRapbm(two.id,1,true)
    expect(row(one.id)).toMatchObject({status:'published',komite_cohort:2026})
    expect(row(two.id)).toMatchObject({status:'published',komite_cohort:2027})
  })
  it('requires acknowledgment of notes before publication',async()=>{
    const v=await importRapbm(file())
    await expect(publishRapbm(v.id,0,false)).rejects.toThrow(/Catatan Angka/)
    expect(row(v.id).status).toBe('draft')
    await publishRapbm(v.id,0,true)
    expect(row(v.id)).toMatchObject({status:'published',notes_acknowledged:1})
    expect(count('activity_logs')).toBe(2)
  })
  it('preserves older versions and rejects concurrent stale publication',async()=>{
    const a=await importRapbm(file());await publishRapbm(a.id,0,true)
    const b=await importRapbm(file()),c=await importRapbm(file())
    await publishRapbm(b.id,1,true)
    await expect(publishRapbm(c.id,1,true)).rejects.toThrow(/sudah berubah/)
    expect(row(a.id).status).toBe('superseded')
    expect(row(b.id).status).toBe('published')
    expect(row(c.id).status).toBe('draft')
    expect((await getRapbmPageData(2026)).selected?.id).toBe(b.id)
    expect((await getRapbmPageData(2026,a.id)).selected?.status).toBe('superseded')
    expect(count('activity_logs')).toBe(5)
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
  it('isolates fiscal years and keeps the previous year available',async()=>{
    const a=await importRapbm(file());await publishRapbm(a.id,0,true)
    const wb=XLSX.read(Buffer.from(source.base64,'base64'),{type:'buffer'});wb.Sheets[wb.SheetNames[0]].B3={t:'s',v:'TAHUN 2025'}
    const b=await importRapbm(new File([new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'}))],'RAPBM 2025.xlsx'))
    await publishRapbm(b.id,0,true)
    expect(row(b.id)).toMatchObject({year:2025,version:1,status:'published'})
    expect(row(a.id).status).toBe('published')
    expect((await getRapbmPageData(2025)).selected?.id).toBe(b.id)
    expect((await getRapbmPageData()).selected?.year).toBe(2026)
  })
  it('does not reveal drafts to readers, even by a direct version identifier',async()=>{
    const v=await importRapbm(file())
    state.canManage=false
    expect(await getRapbmPageData(2026,v.id)).toMatchObject({versions:[],selected:null,document:null,canManage:false})
    await expect(importRapbm(file())).rejects.toThrow('Forbidden')
    await expect(publishRapbm(v.id,0,true)).rejects.toThrow('Forbidden')
    state.canManage=true;await publishRapbm(v.id,0,true);state.canManage=false
    expect((await getRapbmPageData(2026)).selected?.id).toBe(v.id)
  })
  it('rolls back the whole import and removes only its uncommitted source on database failure',async()=>{
    state.failSql='INSERT INTO fin_rapbm_items'
    await expect(importRapbm(file())).rejects.toThrow('write failure')
    expect(count('fin_rapbm_versions')).toBe(0)
    expect(count('fin_rapbm_items')).toBe(0)
    expect(count('activity_logs')).toBe(0)
    expect(state.objects.size).toBe(0)
  })
  it('does not create a draft if source storage fails',async()=>{
    state.put.mockRejectedValueOnce(new Error('R2 unavailable'))
    await expect(importRapbm(file())).rejects.toThrow('R2 unavailable')
    expect(count('fin_rapbm_versions')).toBe(0)
  })
  it('keeps a committed source when only the response was lost',async()=>{
    state.lostResponse=true
    const v=await importRapbm(file())
    expect(row(v.id).status).toBe('draft')
    expect(state.objects.size).toBe(1)
    expect(state.remove).not.toHaveBeenCalled()
  })
  it('rolls back publication and its audit together, retaining the previous published version',async()=>{
    const a=await importRapbm(file());await publishRapbm(a.id,0,true)
    const b=await importRapbm(file())
    state.failSql="SET status='published'"
    await expect(publishRapbm(b.id,1,true)).rejects.toThrow('write failure')
    expect(row(a.id).status).toBe('published')
    expect(row(b.id).status).toBe('draft')
    expect(count('activity_logs')).toBe(3)
    expect(sqlite.prepare('SELECT publication_revision FROM fin_rapbm_years').get()?.publication_revision).toBe(1)
  })
  it('enforces archive immutability below the server interface',async()=>{
    const v=await importRapbm(file());await publishRapbm(v.id,0,true)
    expect(()=>sqlite.prepare("UPDATE fin_rapbm_versions SET title='Changed' WHERE id=?").run(v.id)).toThrow(/tidak boleh/)
    expect(()=>sqlite.prepare('DELETE FROM fin_rapbm_versions WHERE id=?').run(v.id)).toThrow(/tidak boleh/)
    expect(()=>sqlite.exec('UPDATE fin_rapbm_items SET total=1')).toThrow(/tidak boleh/)
    expect(()=>sqlite.exec('DELETE FROM fin_rapbm_groups')).toThrow(/tidak boleh/)
    expect(()=>sqlite.prepare("UPDATE fin_rapbm_versions SET status='draft' WHERE id=?").run(v.id)).toThrow(/tidak diizinkan/)
    expect(()=>sqlite.exec(`INSERT INTO fin_rapbm_items SELECT 'extra',group_id,999,'Extra',NULL,NULL,NULL,'Sheet1!E999',0,0,0 FROM fin_rapbm_items LIMIT 1`)).toThrow(/sudah terbit/)
  })
  it('the deploy migration matches the runtime schema without dropping existing data',()=>{
    const sql=readFileSync(new URL('../migrations/0123_add_rapbm.sql',import.meta.url),'utf8').replace(/\r\n/g,'\n')
    for(const statement of RAPBM_SCHEMA)expect(sql).toContain(statement+';')
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN/)
    sqlite.exec(`CREATE TABLE role_features (role TEXT,feature_id TEXT,UNIQUE(role,feature_id));
      CREATE TABLE role_feature_permissions (role TEXT,feature_id TEXT,can_create INTEGER,can_read INTEGER,can_update INTEGER,can_delete INTEGER,UNIQUE(role,feature_id));
      CREATE TABLE fin_transaksi (id TEXT PRIMARY KEY,amount INTEGER);INSERT INTO fin_transaksi VALUES ('existing',12345);`)
    sqlite.exec(sql)
    expect(count('role_features')).toBe(5)
    expect(sqlite.prepare('SELECT role FROM role_feature_permissions WHERE can_update=1 ORDER BY role').all().map(r=>r.role)).toEqual(['bendahara_komite','super_admin'])
    expect(sqlite.prepare('SELECT amount FROM fin_transaksi').get()?.amount).toBe(12345)
  })
})
