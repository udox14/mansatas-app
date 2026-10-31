import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireRapbmAccess } from './rapbm-access'

const state=vi.hoisted(()=>({session:true,roles:['bendahara_komite'],read:true,create:true,update:true,schema:vi.fn()}))
vi.mock('@/utils/auth/server',()=>({getSession:async()=>state.session?{user:{id:'u1'}}:null}))
vi.mock('@/utils/db-server',()=>({getDB:async()=>({})}))
vi.mock('@/lib/features',()=>({getUserRoles:async()=>state.roles,
  checkFeatureCrudAccess:async(_db:unknown,_id:string,_feature:string,action:'read'|'create'|'update')=>state[action]}))
vi.mock('./rapbm-schema',()=>({ensureRapbmSchema:state.schema}))
beforeEach(()=>{state.session=true;state.roles=['bendahara_komite'];state.read=true;state.create=true;state.update=true;state.schema.mockReset()})

describe('RAPBM access policy',()=>{
  it('requires authentication',async()=>{state.session=false;await expect(requireRapbmAccess()).rejects.toMatchObject({status:401})})
  it.each(['super_admin','bendahara_komite'])('lets %s import and publish',async role=>{
    state.roles=[role]
    expect((await requireRapbmAccess('create')).canManage).toBe(true)
    expect((await requireRapbmAccess('update')).canManage).toBe(true)
    await expect(requireRapbmAccess('delete')).rejects.toMatchObject({status:403})
  })
  it.each(['kepsek','ketua_komite','anggota_komite'])('keeps %s read-only even if a generic CRUD grant exists',async role=>{
    state.roles=[role]
    expect((await requireRapbmAccess()).canManage).toBe(false)
    await expect(requireRapbmAccess('create')).rejects.toMatchObject({status:403})
    await expect(requireRapbmAccess('update')).rejects.toMatchObject({status:403})
  })
  it.each(['wakamad','guru','orang_tua','pembina_ekstrakurikuler'])('rejects %s without an allowed committee role',async role=>{
    state.roles=[role]
    await expect(requireRapbmAccess()).rejects.toMatchObject({status:403})
    expect(state.schema).not.toHaveBeenCalled()
  })
  it('honors feature revocation and read-only permissions',async()=>{
    state.read=false;await expect(requireRapbmAccess()).rejects.toMatchObject({status:403})
    state.read=true;state.update=false
    expect((await requireRapbmAccess()).canManage).toBe(false)
    await expect(requireRapbmAccess('update')).rejects.toMatchObject({status:403})
  })
})
