'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, BarChart3, Settings } from 'lucide-react'
import { SarprasAset, SarprasKategori } from './actions'
import { AsetTab } from './aset-tab'
import { StatistikTab } from './statistik-tab'
import { KategoriModal } from './kategori-modal'

interface SarprasClientProps {
  initialAset: SarprasAset[]
  initialKategori: SarprasKategori[]
  options: {
    merek: string[]
    asal_anggaran: string[]
    keadaan_barang: string[]
    keterangan: string[]
  }
}

export function SarprasClient({ initialAset, initialKategori, options }: SarprasClientProps) {
  const [activeTab, setActiveTab] = useState('data')
  const [isKategoriOpen, setIsKategoriOpen] = useState(false)

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between mb-4">
          <TabsList className="grid w-full md:w-auto grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Data Aset
            </TabsTrigger>
            <TabsTrigger value="statistik" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Statistik
            </TabsTrigger>
          </TabsList>

          {activeTab === 'data' && (
            <button 
              onClick={() => setIsKategoriOpen(true)}
              className="flex items-center justify-center gap-2 text-[13px] font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 hover:text-blue-600 transition-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg shadow-sm w-full md:w-auto"
            >
              <Settings className="w-4 h-4 text-slate-400" /> Kelola Kategori
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <TabsContent value="data" className="p-0 m-0 outline-none">
            <AsetTab aset={initialAset} kategori={initialKategori} options={options} />
          </TabsContent>
          <TabsContent value="statistik" className="p-0 m-0 outline-none">
            <StatistikTab aset={initialAset} kategori={initialKategori} />
          </TabsContent>
        </div>
      </Tabs>

      <KategoriModal 
        isOpen={isKategoriOpen} 
        onClose={() => setIsKategoriOpen(false)} 
        kategori={initialKategori} 
      />
    </div>
  )
}
