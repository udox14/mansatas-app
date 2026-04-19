'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SarprasAset, SarprasKategori, saveAset, uploadFotoAsetAction } from './actions'
import { Loader2, UploadCloud, X, Image as ImageIcon } from 'lucide-react'
import { todayWIB } from '@/lib/time'

interface AsetFormModalProps {
  isOpen: boolean
  onClose: () => void
  kategori: SarprasKategori[]
  options: {
    merek: string[]
    asal_anggaran: string[]
    keadaan_barang: string[]
    keterangan: string[]
  }
  initialData?: SarprasAset | null
}

export function AsetFormModal({ isOpen, onClose, kategori, options, initialData }: AsetFormModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  
  const [tanggalDb, setTanggalDb] = useState(todayWIB())
  const [kategoriId, setKategoriId] = useState('')
  const [namaBarang, setNamaBarang] = useState('')
  const [merek, setMerek] = useState('')
  const [kuantitas, setKuantitas] = useState(1)
  const [tahunPembuatan, setTahunPembuatan] = useState('')
  const [asalAnggaran, setAsalAnggaran] = useState('')
  const [keadaanBarang, setKeadaanBarang] = useState('')
  const [harga, setHarga] = useState('')
  const [keterangan, setKeterangan] = useState('')
  
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTanggalDb(initialData.tanggal_pembukuan || todayWIB())
        setKategoriId(initialData.kategori_id || '')
        setNamaBarang(initialData.nama_barang || '')
        setMerek(initialData.merek || '')
        setKuantitas(initialData.kuantitas || 1)
        setTahunPembuatan(initialData.tahun_pembuatan || '')
        setAsalAnggaran(initialData.asal_anggaran || '')
        setKeadaanBarang(initialData.keadaan_barang || '')
        setHarga(initialData.harga?.toString() || '')
        setKeterangan(initialData.keterangan || '')
        setFotoUrl(initialData.foto_url || null)
      } else {
        setTanggalDb(todayWIB())
        setKategoriId(kategori.length > 0 ? kategori[0].id : '')
        setNamaBarang('')
        setMerek('')
        setKuantitas(1)
        setTahunPembuatan('')
        setAsalAnggaran('')
        setKeadaanBarang('BAIK')
        setHarga('')
        setKeterangan('BERFUNGSI')
        setFotoUrl(null)
      }
      setError(null)
    }
  }, [isOpen, initialData, kategori])

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('foto', file)
    
    const res = await uploadFotoAsetAction(formData)
    if (res.error) {
      setError(res.error)
    } else if (res.url) {
      setFotoUrl(res.url)
    }
    
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!namaBarang || !kategoriId || !tanggalDb) {
      setError('Harap isi field yang wajib (Tanggal, Kategori, Nama Barang)')
      return
    }

    startTransition(async () => {
      const payload: Partial<SarprasAset> = {
        id: initialData?.id,
        tanggal_pembukuan: tanggalDb,
        kategori_id: kategoriId,
        nama_barang: namaBarang,
        merek: merek || null,
        kuantitas: kuantitas,
        tahun_pembuatan: tahunPembuatan || null,
        asal_anggaran: asalAnggaran || null,
        keadaan_barang: keadaanBarang || null,
        harga: harga ? parseInt(harga.replace(/\D/g, ''), 10) : null,
        foto_url: fotoUrl,
        keterangan: keterangan || null
      }
      
      const res = await saveAset(payload)
      if (res.error) {
        setError(res.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{initialData ? 'Edit Data Aset' : 'Tambah Data Aset'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-6 py-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Kategori *</label>
                  <select 
                    value={kategoriId} 
                    onChange={e => setKategoriId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
                    required
                  >
                    <option value="" disabled>Pilih Kategori...</option>
                    {kategori.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Tanggal Pembukuan *</label>
                  <input 
                    type="date" 
                    value={tanggalDb} 
                    onChange={e => setTanggalDb(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nama Barang *</label>
                  <input 
                    type="text" 
                    value={namaBarang} 
                    onChange={e => setNamaBarang(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Merek</label>
                  <input 
                    type="text" 
                    list="sarpras_merek"
                    value={merek} 
                    onChange={e => setMerek(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                    placeholder="Contoh: JOYKO, EPSON..."
                  />
                  <datalist id="sarpras_merek">
                    {options.merek.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">Kuantitas *</label>
                    <input 
                      type="number" 
                      min="1"
                      value={kuantitas} 
                      onChange={e => setKuantitas(parseInt(e.target.value) || 1)}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">Tahun Pembuatan</label>
                    <input 
                      type="text" 
                      value={tahunPembuatan} 
                      onChange={e => setTahunPembuatan(e.target.value)}
                      className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                      placeholder="Contoh: 2023, 2021/2022"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Asal Anggaran</label>
                  <input 
                    type="text" 
                    list="sarpras_anggaran"
                    value={asalAnggaran} 
                    onChange={e => setAsalAnggaran(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                  />
                  <datalist id="sarpras_anggaran">
                    <option value="ANGGARAN" />
                    <option value="HIBAH" />
                    {options.asal_anggaran.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Keadaan Barang</label>
                  <input 
                    type="text" 
                    list="sarpras_keadaan"
                    value={keadaanBarang} 
                    onChange={e => setKeadaanBarang(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                  />
                  <datalist id="sarpras_keadaan">
                    <option value="BAIK" />
                    <option value="KURANG BAIK" />
                    <option value="RUSAK" />
                    {options.keadaan_barang.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Keterangan / Fungsi</label>
                  <input 
                    type="text" 
                    list="sarpras_keterangan"
                    value={keterangan} 
                    onChange={e => setKeterangan(e.target.value)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                  />
                  <datalist id="sarpras_keterangan">
                    <option value="BERFUNGSI" />
                    <option value="TIDAK BERFUNGSI" />
                    {options.keterangan.map(o => <option key={o} value={o} />)}
                  </datalist>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1.5 block">Harga (Rp)</label>
                  <input 
                    type="text" 
                    value={harga} 
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '')
                      setHarga(val ? parseInt(val).toLocaleString('id-ID') : '')
                    }}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-sm font-medium mb-1.5 block">Foto Barang</label>
                  {fotoUrl ? (
                    <div className="relative inline-block border rounded-lg bg-slate-100 dark:bg-slate-800/80 overflow-hidden group">
                      <img src={fotoUrl} alt="Foto barang" className="h-32 w-auto object-contain" />
                      <button 
                        type="button" 
                        onClick={() => setFotoUrl(null)}
                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => !isUploading && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {isUploading ? <Loader2 className="w-8 h-8 animate-spin mb-2" /> : <ImageIcon className="w-8 h-8 mb-2 opacity-50" />}
                      <span className="text-sm">{isUploading ? 'Mengupload...' : 'Klik untuk upload foto'}</span>
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFotoUpload}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-md transition-colors"
                disabled={isPending || isUploading}
              >
                Batal
              </button>
              <button 
                type="submit"
                disabled={isPending || isUploading}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors flex items-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Simpan Data
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
