'use client'

import { useMemo } from 'react'
import { SarprasAset, SarprasKategori } from './actions'
import { PackageOpen, AlertTriangle, CheckCircle2, DollarSign, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function StatistikTab({ aset, kategori }: { aset: SarprasAset[], kategori: SarprasKategori[] }) {
  
  const stats = useMemo(() => {
    let totalValue = 0
    let totalItems = 0
    let baik = 0
    let rusak = 0
    let kurangBaik = 0
    
    // items count by category
    const byCategory: Record<string, number> = {}

    for (const a of aset) {
      const q = a.kuantitas || 1
      totalItems += q
      totalValue += (a.harga || 0) * q
      
      const st = a.keadaan_barang?.toUpperCase() || ''
      if (st === 'BAIK') baik += q
      else if (st === 'RUSAK') rusak += q
      else if (st === 'KURANG BAIK') kurangBaik += q

      const katName = a.kategori_nama || 'Tanpa Kategori'
      byCategory[katName] = (byCategory[katName] || 0) + q
    }

    return { totalValue, totalItems, baik, rusak, kurangBaik, byCategory }
  }, [aset])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Aset */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Kuantitas Aset</CardTitle>
            <div className="p-2 bg-blue-50 rounded-md">
              <PackageOpen className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{stats.totalItems.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>

        {/* Card 2: Kondisi Baik */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Kondisi Baik</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-md">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{stats.baik.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>

        {/* Card 3: Rusak */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Perlu Perbaikan (Rusak)</CardTitle>
            <div className="p-2 bg-red-50 rounded-md">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{(stats.rusak + stats.kurangBaik).toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>

        {/* Card 4: Nilai Aset */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Estimasi Nilai Aset</CardTitle>
            <div className="p-2 bg-amber-50 rounded-md">
              <DollarSign className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Rp {stats.totalValue.toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Sebaran Berdasarkan Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.byCategory).length === 0 ? (
              <p className="text-muted-foreground text-sm">Belum ada data.</p>
            ) : (
              <div className="space-y-4 pt-2">
                {Object.entries(stats.byCategory).sort((a,b) => b[1] - a[1]).map(([name, count]) => (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-semibold text-slate-700">{name}</span>
                      <span className="text-slate-500 font-medium">{count} item ({(count / Math.max(1, stats.totalItems) * 100).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full" 
                        style={{ width: `${(count / Math.max(1, stats.totalItems)) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm flex flex-col justify-center items-center text-center p-8 bg-slate-50/50">
          <div className="bg-white rounded-full p-6 shadow-sm border border-slate-100 mb-4">
             <BarChart3 className="w-12 h-12 text-slate-300" />
          </div>
          <h4 className="font-semibold text-slate-800 text-lg">Grafik Lanjut</h4>
          <p className="text-sm text-slate-500 mt-2 max-w-xs">
            Statistik dan laporan analitik lanjutan dapat ditambahkan di sini berdasarkan request spesifik.
          </p>
        </Card>
      </div>

    </div>
  )
}
