import { PageHeader } from '@/components/layout/page-header'
import { getAsetList, getKategoriList, getSarprasOptions } from './actions'
import { SarprasClient } from './sarpras-client'

export const dynamic = 'force-dynamic' // ← tambah ini

export const metadata = { title: 'Sarana Prasarana | MANSATAS' }

export default async function SarprasPage() {
  const [asetRes, kategoriRes, options] = await Promise.all([
    getAsetList(),
    getKategoriList(),
    getSarprasOptions()
  ])
  return (
    <div className="flex-1 flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-800 dark:bg-slate-900/50">
      <PageHeader 
        title="Sarana Prasarana" 
        description="Manajemen inventaris dan aset fasilitas madrasah"
      />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
         <SarprasClient 
           initialAset={asetRes.data}
           initialKategori={kategoriRes.data}
           options={options}
         />
      </div>
    </div>
  )
}