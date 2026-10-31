import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'
import { RapbmValidationError } from '@/lib/rapbm'
import { RapbmAccessError } from '@/lib/rapbm-access'

const state=vi.hoisted(()=>({status:0,importFile:vi.fn()}))
vi.mock('@/lib/rapbm-access',()=>({RapbmAccessError:class extends Error{constructor(public status:number){super('Forbidden')}},requireRapbmAccess:async()=>{if(state.status)throw new RapbmAccessError(state.status)}}))
vi.mock('@/lib/rapbm-service',()=>({importRapbm:state.importFile}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
beforeEach(()=>{state.status=0;state.importFile.mockReset().mockResolvedValue({id:'draft',year:2026,success:'Draft tersimpan'})})
const base='https://mansatas.test/api/keuangan/rapbm/import'
function request(files=1){
  const form=new FormData()
  for(let i=0;i<files;i++)form.append('file',new File(['xlsx'],'RAPBM.xlsx'))
  return new Request(base,{method:'POST',body:form,headers:{origin:'https://mansatas.test'}})
}
describe('RAPBM import transport',()=>{
  it.each([401,403])('checks access before reading an upload (%s)',async status=>{
    state.status=status;expect((await POST(request())).status).toBe(status);expect(state.importFile).not.toHaveBeenCalled()
  })
  it('rejects cross-origin cookie requests',async()=>{
    expect((await POST(new Request(base,{method:'POST',headers:{origin:'https://other.test',cookie:'session=x'}}))).status).toBe(403)
    expect(state.importFile).not.toHaveBeenCalled()
  })
  it('requires one multipart file',async()=>{
    expect((await POST(new Request(base,{method:'POST',body:'x',headers:{origin:'https://mansatas.test'}}))).status).toBe(415)
    expect((await POST(request(2))).status).toBe(400)
    expect(state.importFile).not.toHaveBeenCalled()
  })
  it('rejects over-limit requests',async()=>{
    const req=request();req.headers.set('content-length',String(7*1024*1024))
    expect((await POST(req)).status).toBe(413)
  })
  it('passes a single Excel file through the guarded action and reports validation errors',async()=>{
    expect((await POST(request())).status).toBe(200)
    expect(state.importFile.mock.calls[0][0].name).toBe('RAPBM.xlsx')
    state.importFile.mockRejectedValueOnce(new RapbmValidationError('Format tidak dikenali.'))
    expect((await POST(request())).status).toBe(400)
  })
})
