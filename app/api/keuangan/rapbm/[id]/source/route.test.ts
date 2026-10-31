import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { RapbmAccessError } from '@/lib/rapbm-access'

const state=vi.hoisted(()=>({status:'draft',canManage:false,accessStatus:0,exists:true,object:true,read:vi.fn()}))
vi.mock('@/lib/rapbm-access',()=>({RapbmAccessError:class extends Error{constructor(public status:number){super('Forbidden')}},requireRapbmAccess:async()=>{
  if(state.accessStatus)throw new RapbmAccessError(state.accessStatus)
  return {canManage:state.canManage,db:{prepare:()=>({bind(){return this},first:async()=>state.exists?{status:state.status,r2_key:'private/rapbm/2026/id.xlsx',original_filename:'RAPBM 2026.xlsx'}:null})}}
}}))
vi.mock('@/lib/rapbm-storage',()=>({readRapbmSource:state.read}))
beforeEach(()=>{state.status='draft';state.canManage=false;state.accessStatus=0;state.exists=true;state.object=true
  state.read.mockReset().mockImplementation(async()=>state.object?{body:new Response('original Excel bytes').body}:null)})
const request=()=>GET(new Request('https://mansatas.test/api/keuangan/rapbm/id/source'),{params:Promise.resolve({id:'id'})})
describe('private RAPBM source download',()=>{
  it.each([401,403])('rejects access with %s before reading R2',async status=>{
    state.accessStatus=status;expect((await request()).status).toBe(status);expect(state.read).not.toHaveBeenCalled()
  })
  it('hides draft sources from readers using direct URLs',async()=>{
    expect((await request()).status).toBe(404);expect(state.read).not.toHaveBeenCalled()
  })
  it.each(['published','superseded'])('serves %s source bytes without public caching',async status=>{
    state.status=status;const response=await request()
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('original Excel bytes')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toContain('RAPBM%202026.xlsx')
  })
  it('allows draft downloads for managers and handles missing source objects',async()=>{
    state.canManage=true;expect((await request()).status).toBe(200)
    state.object=false;expect((await request()).status).toBe(404)
  })
})
