import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { getDB } from '@/utils/db-server'
import { RapbmAccessError } from '@/lib/rapbm-access'
import { getRapbmPageData } from '@/lib/rapbm-service'
import { RapbmClient } from './rapbm-client'

export const dynamic='force-dynamic'
export const metadata={title:'RAPBM | Keuangan Komite MANSATAS'}

export default async function RapbmPage({searchParams}:{searchParams:Promise<{year?:string;version?:string}>}) {
  const params=await searchParams
  let data
  try { data=await getRapbmPageData(params.year ? Number(params.year) : undefined,params.version) }
  catch(error) {
    if (error instanceof RapbmAccessError) redirect(error.status===401?'/login':'/dashboard')
    throw error
  }
  const db=await getDB()
  const [groups,positions,history,associations,remaining]=await Promise.all([
    db.prepare(`SELECT g.id,g.label,g.account,g.komite,COALESCE(SUM(i.komite),0) detail FROM fin_rapbm_groups g
      LEFT JOIN fin_rapbm_items i ON i.group_id=g.id WHERE g.version_id=? AND g.section='expense' GROUP BY g.id ORDER BY g.sort_order`).bind(data.selected?.id??'').all<{id:string;label:string;account:string|null;komite:number|null;detail:number}>(),
    db.prepare('SELECT group_id,label,account,amount,available,locked,realized FROM fin_komite_budget_balances WHERE version_id=?').bind(data.selected?.id??'').all<{group_id:string;label:string;account:string|null;amount:number;available:number;locked:number;realized:number}>(),
    db.prepare(`SELECT a.id,a.group_id,a.amount,CASE WHEN e.is_void=1 THEN 'released' ELSE a.state END state,a.cashflow_id,a.pengajuan_id,a.created_at,
        COALESCE(p.nomor_spb,e.proof_number) proof,COALESCE(p.judul,e.description) description
      FROM fin_komite_allocations a JOIN fin_rapbm_groups g ON g.id=a.group_id
      LEFT JOIN komite_pengajuan p ON p.id=a.pengajuan_id LEFT JOIN fin_cashflow_entries e ON e.id=a.cashflow_id
      WHERE g.version_id=? AND a.state<>'review' ORDER BY a.created_at DESC,a.id`).bind(data.selected?.id??'').all<{id:string;group_id:string;amount:number;state:string;cashflow_id:string|null;pengajuan_id:string|null;created_at:string;proof:string|null;description:string}>(),
    db.prepare(`SELECT v.id,v.year,COALESCE(o.cohort,v.komite_cohort) cohort,o.enabled,o.carry_forward,o.revision_reason
      FROM fin_rapbm_versions v LEFT JOIN fin_komite_rapbm_versions o ON o.version_id=v.id
      WHERE v.status<>'draft' OR ?=1`).bind(data.canManage?1:0)
      .all<{id:string;year:number;cohort:number|null;enabled:number|null;carry_forward:number|null;revision_reason:string|null}>(),
    db.prepare('SELECT version_id,cohort,available FROM fin_komite_revision_balance').all<{version_id:string;cohort:number;available:number}>(),
  ])
  return <div className="space-y-4 pb-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
    <PageHeader title="RAPBM" description="Rencana Anggaran Pendapatan dan Belanja Madrasah" />
    <RapbmClient data={data} budget={{ groups:groups.results,positions:positions.results,history:history.results,associations:associations.results,remaining:remaining.results }} />
  </div>
}
