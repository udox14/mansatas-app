'use client'

import * as React from 'react'
import { useState, useRef, useTransition, useMemo } from 'react'
import { SarprasAset, SarprasKategori, deleteAset } from './actions'
import { AsetFormModal } from './aset-form-modal'
import { Printer, Plus, Search, Filter, Trash2, Edit2, Loader2, Image as ImageIcon } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

// UI Components
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'

interface AsetTabProps {
  aset: SarprasAset[]
  kategori: SarprasKategori[]
  options: {
    merek: string[]
    asal_anggaran: string[]
    keadaan_barang: string[]
    keterangan: string[]
  }
}

export function AsetTab({ aset: initialAset, kategori, options }: AsetTabProps) {
  const [data, setData] = useState<SarprasAset[]>(initialAset)
  const [isPending, startTransition] = useTransition()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAset, setEditingAset] = useState<SarprasAset | null>(null)
  
  const [search, setSearch] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [filterKeadaan, setFilterKeadaan] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Laporan_Inventaris_Madrasah',
  })

  useMemo(() => setData(initialAset), [initialAset])

  const filteredData = data.filter(a => {
    let match = true
    if (search) {
      match = match && (
        a.nama_barang.toLowerCase().includes(search.toLowerCase()) || 
        (a.merek || '').toLowerCase().includes(search.toLowerCase())
      )
    }
    if (filterKategori) {
      match = match && a.kategori_id === filterKategori
    }
    if (filterKeadaan) {
      match = match && a.keadaan_barang === filterKeadaan
    }
    if (startDate) {
      match = match && a.tanggal_pembukuan >= startDate
    }
    if (endDate) {
      match = match && a.tanggal_pembukuan <= endDate
    }
    return match
  })

  // Group by category
  const groupedData = filteredData.reduce((acc, curr) => {
    const kat = curr.kategori_nama || 'Tanpa Kategori'
    if (!acc[kat]) acc[kat] = []
    acc[kat].push(curr)
    return acc
  }, {} as Record<string, SarprasAset[]>)

  const handleDelete = (id: string) => {
    if (!confirm('Yakin ingin menghapus data aset ini?')) return
    startTransition(async () => {
      const res = await deleteAset(id)
      if (res?.error) alert(res.error)
    })
  }

  const handleEdit = (aset: SarprasAset) => {
    setEditingAset(aset)
    setIsFormOpen(true)
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* TOOLBAR */}
      <div className="flex flex-col gap-4">
        {/* Search and Filters Row */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1 md:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              type="text" 
              placeholder="Cari barang / merek..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11 md:h-10"
            />
          </div>

          <div className="grid grid-cols-2 lg:flex items-center gap-2">
            <select 
              value={filterKategori} 
              onChange={e => setFilterKategori(e.target.value)}
              className="flex h-11 md:h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Semua Kategori</option>
              {kategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <select 
              value={filterKeadaan} 
              onChange={e => setFilterKeadaan(e.target.value)}
              className="flex h-11 md:h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Semua Kondisi</option>
              <option value="BAIK">Baik</option>
              <option value="KURANG BAIK">Kurang Baik</option>
              <option value="RUSAK">Rusak</option>
            </select>
          </div>
        </div>

        {/* Date and Actions Row */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-800 px-3 h-11 md:h-10 bg-slate-50 dark:bg-slate-800 dark:bg-slate-900/50 text-[13px] w-full md:w-auto">
             <span className="text-muted-foreground font-medium whitespace-nowrap">Periode:</span>
             <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="bg-transparent outline-none cursor-pointer flex-1" title="Dari Tanggal" />
             <span className="text-muted-foreground">-</span>
             <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="bg-transparent outline-none cursor-pointer flex-1" title="Sampai Tanggal" />
          </div>

          <div className="grid grid-cols-2 md:flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint} className="h-11 md:h-10 gap-2 border-slate-200 dark:border-slate-800">
              <Printer className="w-4 h-4" /> Cetak PDF
            </Button>
            <Button onClick={() => { setEditingAset(null); setIsFormOpen(true) }} className="h-11 md:h-10 gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4" /> Tambah Aset
            </Button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="border rounded-xl bg-white dark:bg-slate-900 dark:bg-slate-950 shadow-sm relative min-h-[400px] overflow-hidden">
        {isPending && (
          <div className="absolute inset-0 bg-white dark:bg-slate-900/60 dark:bg-slate-950/60 z-10 flex items-center justify-center backdrop-blur-sm rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/80 dark:bg-slate-900/80">
              <TableRow>
                <TableHead className="w-12 text-center whitespace-nowrap">No</TableHead>
                <TableHead className="whitespace-nowrap">Nama & Merek</TableHead>
                <TableHead className="whitespace-nowrap text-center">Qty</TableHead>
                <TableHead className="whitespace-nowrap">Tahun & Pembukuan</TableHead>
                <TableHead className="whitespace-nowrap">Sumber Dana</TableHead>
                <TableHead className="whitespace-nowrap">Kondisi</TableHead>
                <TableHead className="whitespace-nowrap">Harga</TableHead>
                <TableHead className="text-center whitespace-nowrap">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(groupedData).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                    Data aset tidak ditemukan
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(groupedData).map(([kategoriName, items]) => (
                  <React.Fragment key={kategoriName}>
                    <TableRow className="bg-blue-50/40 hover:bg-blue-50/40 cursor-default">
                      <TableCell colSpan={8} className="py-2 text-blue-700 text-[13px] uppercase tracking-wider font-semibold border-y border-blue-100">
                        {kategoriName} ({items.length} item)
                      </TableCell>
                    </TableRow>
                    {items.map((item, index) => (
                      <TableRow key={item.id} className="group">
                        <TableCell className="text-center text-muted-foreground font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {item.foto_url ? (
                              <img src={item.foto_url} alt="foto" className="w-10 h-10 rounded-md object-cover border shadow-sm" />
                            ) : (
                              <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 border border-slate-200 dark:border-slate-800">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{item.nama_barang}</div>
                              <div className="text-xs text-muted-foreground">{item.merek || '-'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700 dark:text-slate-300">{item.kuantitas}</TableCell>
                        <TableCell>
                          <div className="text-slate-800 dark:text-slate-200 font-medium">{item.tahun_pembuatan || '-'}</div>
                          <div className="text-xs text-muted-foreground">{item.tanggal_pembukuan}</div>
                        </TableCell>
                        <TableCell>
                          <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-800">
                            {item.asal_anggaran || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                            item.keadaan_barang === 'BAIK' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                            item.keadaan_barang === 'KURANG BAIK' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            item.keadaan_barang === 'RUSAK' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                          }`}>
                            {item.keadaan_barang || '-'}
                          </span>
                          {item.keterangan && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[150px] truncate" title={item.keterangan}>{item.keterangan}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-sm tracking-tight">
                          {item.harga ? `Rp ${item.harga.toLocaleString('id-ID')}` : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100" onClick={() => handleEdit(item)} title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleDelete(item.id)} title="Hapus">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* HIDDEN PRINT CONTENT */}
      <div className="hidden">
        <div ref={printRef} style={{ padding: '0', fontFamily: 'Times New Roman, serif', background: '#fff' }}>
          <style>{`
            @media print {
              @page { size: 330mm 215mm; margin: 15mm; }
              body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
              .print-container { padding: 0; }
            }
            .kop-img { width: 100%; display: block; margin-bottom: 12px; }
            .judul-p { text-align: center; margin-bottom: 15px; }
            .judul-p h2 { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; }
            .judul-p p { font-size: 11px; margin: 4px 0 0; color: #666; }
            table.printable-table { width: 100%; border-collapse: collapse; font-size: 10px; }
            table.printable-table th, table.printable-table td { border: 1px solid #000; padding: 4px 6px; }
            table.printable-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
          `}</style>
          
          <div className="print-container">
            <img src="/kopsurat.png" alt="Kop Surat" className="kop-img" />
            
            <div className="judul-p">
              <h2>Buku Inventaris (Sarana & Prasarana)</h2>
              <p>MTS KH. A. WAHAB MUHSIN SUKAHIDENG<br/>Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
            </div>
            
            <table className="w-full text-xs text-left border-collapse border border-black printable-table">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-2 text-center">No</th>
                  <th className="border border-black p-2">Tgl Buku</th>
                  <th className="border border-black p-2">Nama Barang / Merek</th>
                  <th className="border border-black p-2 text-center">Jml</th>
                  <th className="border border-black p-2 text-center">Tahun</th>
                  <th className="border border-black p-2">Asal</th>
                  <th className="border border-black p-2">Keadaan</th>
                  <th className="border border-black p-2 text-right">Harga</th>
                  <th className="border border-black p-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedData).map(([kat, items]) => (
                  <React.Fragment key={kat}>
                    <tr className="bg-gray-200">
                      <td colSpan={9} className="border border-black p-2 font-bold uppercase">{kat}</td>
                    </tr>
                    {items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className="border border-black p-2 text-center">{idx + 1}</td>
                        <td className="border border-black p-2">{it.tanggal_pembukuan}</td>
                        <td className="border border-black p-2 font-medium">
                          {it.nama_barang}
                          {it.merek && <div className="text-gray-600 mt-0.5">{it.merek}</div>}
                        </td>
                        <td className="border border-black p-2 text-center">{it.kuantitas}</td>
                        <td className="border border-black p-2 text-center">{it.tahun_pembuatan || '-'}</td>
                        <td className="border border-black p-2">{it.asal_anggaran || '-'}</td>
                        <td className="border border-black p-2">{it.keadaan_barang || '-'}</td>
                        <td className="border border-black p-2 text-right">{it.harga ? `Rp ${it.harga.toLocaleString('id-ID')}` : '-'}</td>
                        <td className="border border-black p-2">{it.keterangan || '-'}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AsetFormModal 
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        kategori={kategori}
        options={options}
        initialData={editingAset}
      />
    </div>
  )
}
