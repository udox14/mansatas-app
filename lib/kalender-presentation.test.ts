import { describe, expect, it } from 'vitest'
import { kalenderDateStatusFromEvents, type KalenderEvent } from './kalender-pendidikan'

const event = (overrides: Partial<KalenderEvent> = {}): KalenderEvent => ({id:'holiday',start_date:'2026-10-02',end_date:'2026-10-04',title:'Libur sekolah',category:'LAINNYA',is_effective:0,source:'official',external_id:null,description:null,...overrides})
describe('calendar presentation uses existing holiday precedence', () => {
  it('distinguishes holidays and effective dates across a batched range', () => {
    const events = [event()]
    expect(kalenderDateStatusFromEvents('2026-10-02',events)).toMatchObject({isEffective:false,reason:'Libur sekolah'})
    expect(kalenderDateStatusFromEvents('2026-10-05',events)).toMatchObject({isEffective:true,reason:null,events:[]})
    expect(kalenderDateStatusFromEvents('2026-10-04',[])).toMatchObject({isEffective:false,reason:'Minggu'})
  })
  it('respects a manual effective-day override even on a Sunday', () => {
    const events = [event(),event({id:'manual',source:'manual',is_effective:1,title:'KBM pengganti'})]
    expect(kalenderDateStatusFromEvents('2026-10-04',events)).toMatchObject({isEffective:true,reason:'KBM pengganti'})
  })
})
