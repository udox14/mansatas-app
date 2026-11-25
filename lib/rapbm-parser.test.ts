import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import source from '@/data/rapbm-2026-source.json'
import { parseRapbm } from './rapbm-parser'
import { filterRapbmGroups } from './rapbm'

const bytes = () => new Uint8Array(Buffer.from(source.base64,'base64'))
function changed(change: (ws: Record<string, any>) => void) {
  const wb=XLSX.read(bytes(),{type:'array'})
  change(wb.Sheets[wb.SheetNames[0]])
  return new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'}))
}

describe('RAPBM source parser', () => {
  it('keeps the supplied 2026 source, 17 groups and 105 expense details without recalculating it', () => {
    const doc=parseRapbm(bytes())
    expect(doc.year).toBe(2026)
    expect(doc.expenses).toHaveLength(17)
    expect(doc.expenses.flatMap(g=>g.items)).toHaveLength(105)
    expect(doc.income).toHaveLength(2)
    expect(doc.incomeTotal.total).toBe(4666436000)
    expect(doc.expenseTotal).toEqual({apbn:2454236000,komite:2212200000,total:4666436000})
    const furniture=doc.expenses.flatMap(g=>g.items).find(i=>i.reference==='RAPBM 2026!E124:J124')!
    expect(furniture.amounts).toEqual({apbn:115200000,komite:null,total:null})
    expect(furniture.volume).toBe('72')
    expect(doc.notes).toContainEqual(expect.objectContaining({reference:'RAPBM 2026!J124',source:null,calculated:115200000}))
    expect(doc.notes).toContainEqual(expect.objectContaining({reference:'RAPBM 2026!J66',source:101900000,calculated:189260000}))
    expect(doc.expenses.filter(g=>g.account==='521111')).toHaveLength(2)
    expect(doc.expenses.find(g=>g.order===17)?.items[0].account).toBe('522111')
    expect(doc.expenses.flatMap(g=>g.items).some(i=>i.amounts.total===0)).toBe(true)
  })
  it('supports another fiscal year without using the academic year', () => {
    expect(parseRapbm(changed(ws=>{ws.B3={t:'s',v:'TAHUN 2025'}})).year).toBe(2025)
  })
  it('does not turn a missing income subtotal into zero',()=>{
    const doc=parseRapbm(changed(ws=>{delete ws.H12}))
    expect(doc.incomeTotal.apbn).toBeNull()
    expect(doc.notes.some(note=>note.reference==='RAPBM 2026!H12')).toBe(true)
  })
  it.each(['negative','text','error','unsafe'])('rejects unreadable %s money', kind => {
    expect(()=>parseRapbm(changed(ws=>{ ws.H23=kind==='text'?{t:'s',v:'Rp 46.440.000'}:kind==='error'?{t:'e',v:7}:{t:'n',v:kind==='negative'?-1:Number.MAX_SAFE_INTEGER+1} }))).toThrow(/nominal/)
  })
  it('rejects wrong layouts and renamed non-XLSX files', () => {
    expect(()=>parseRapbm(changed(ws=>{ws.H20={t:'s',v:'Sumber lainnya'}}))).toThrow(/format/)
    expect(()=>parseRapbm(new TextEncoder().encode('<html>RAPBM</html>'))).toThrow(/XLSX/)
    expect(()=>parseRapbm(new Uint8Array(6*1024*1024+1))).toThrow(/6 MB/)
  })
  it('does not silently drop money when a detail description is missing',()=>{
    expect(()=>parseRapbm(changed(ws=>{delete ws.E23}))).toThrow(/nominal tanpa uraian/)
  })
  it('filters funding sources without losing original group subtotals or zero rows in the unfiltered view', () => {
    const doc=parseRapbm(bytes())
    expect(filterRapbmGroups(doc.expenses,'','all').flatMap(g=>g.items)).toHaveLength(105)
    const result=filterRapbmGroups(doc.expenses,'Internet','apbn')
    expect(result[0].items).toHaveLength(1)
    expect(result[0].amounts.total).toBe(715413000)
    expect(filterRapbmGroups(doc.expenses,'Internet','komite')).toHaveLength(0)
  })
})
