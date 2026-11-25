import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importInitialRapbmAction, importRapbmAction, publishRapbmAction } from './actions'
import { RapbmValidationError } from '@/lib/rapbm'

const state=vi.hoisted(()=>({deny:false,importFile:vi.fn(),publish:vi.fn(),revalidate:vi.fn()}))
vi.mock('@/lib/rapbm-access',()=>({RapbmAccessError:class extends Error{},requireRapbmAccess:async()=>{if(state.deny)throw new RapbmValidationError('Tidak diizinkan.')}}))
vi.mock('@/lib/rapbm-service',()=>({importRapbm:state.importFile,publishRapbm:state.publish}))
vi.mock('next/cache',()=>({revalidatePath:state.revalidate}))
beforeEach(()=>{state.deny=false;state.importFile.mockReset().mockResolvedValue({id:'v1',year:2026});state.publish.mockReset().mockResolvedValue({id:'v1',year:2026});state.revalidate.mockReset()})
describe('RAPBM server action feedback',()=>{
  it('prepares the original 2026 Excel through the normal import pipeline',async()=>{
    expect(await importInitialRapbmAction()).toMatchObject({id:'v1',year:2026})
    const file=state.importFile.mock.calls[0][0] as File
    expect(file.name).toBe('RAPBM 2026.xlsx')
    expect(file.size).toBe(28142)
    expect(state.revalidate).toHaveBeenCalledWith('/dashboard/keuangan/rapbm')
  })
  it('retains readable validation feedback in production-safe action results',async()=>{
    state.publish.mockRejectedValueOnce(new RapbmValidationError('Baca Catatan Angka.'))
    expect(await publishRapbmAction('v1',0,false)).toEqual({error:'Baca Catatan Angka.'})
    expect(await importRapbmAction(new FormData())).toHaveProperty('error')
  })
  it('does not reveal database details and guards initial imports',async()=>{
    const log=vi.spyOn(console,'error').mockImplementation(()=>undefined)
    state.importFile.mockRejectedValueOnce(new Error('D1: INSERT INTO secret'))
    const result=await importInitialRapbmAction()
    expect(result.error).not.toContain('INSERT')
    state.deny=true;state.importFile.mockClear()
    expect(await importInitialRapbmAction()).toHaveProperty('error')
    expect(state.importFile).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
