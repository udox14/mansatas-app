import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
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
  return <div className="space-y-4 pb-10 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
    <PageHeader title="RAPBM" description="Rencana Anggaran Pendapatan dan Belanja Madrasah" />
    <RapbmClient data={data} />
  </div>
}
