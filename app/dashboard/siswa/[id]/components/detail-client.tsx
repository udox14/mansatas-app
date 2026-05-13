// Lokasi: app/dashboard/siswa/[id]/components/detail-client.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { 
  User, GraduationCap, ShieldAlert, DoorOpen, LineChart, 
  MapPin, Phone, Users, CheckCircle2, History, AlertTriangle, 
  Image as ImageIcon, ChevronDown, ChevronUp, BookOpen, Pencil,
  LogOut, RotateCcw, CalendarSearch, ShieldCheck, Wallet, Receipt, Landmark
} from 'lucide-react'
import { EditSiswaModal } from '../../components/edit-modal'
import { TandaiKeluarModal, BatalkanKeluarModal } from './tandai-keluar-modal'
import { RekapAbsensiTab } from './rekap-absensi-tab'
import { formatNamaKelas } from '@/lib/utils'
import { formatTimeWIB } from '@/lib/time'
import type { SanksiConfig } from '../../../kedisiplinan/actions'

export function DetailSiswaClient({
  siswa, riwayatKelas, pelanggaran, izinKeluar, izinKelas, keteranganWaliKelas, keuangan, kelasList, currentUser, sanksiList, initialTab = 'biodata'
}: {
  siswa: any, riwayatKelas: any[], pelanggaran: any[], izinKeluar: any[], izinKelas: any[], keteranganWaliKelas: any[]
  keuangan?: { dspt: any | null; sppSaldoAwal: any | null; transaksi: any[] }
  kelasList?: any[],
  currentUser: any
  sanksiList?: SanksiConfig[]
  initialTab?: string
}) {
  const router = useRouter()
  const [showKeluarModal, setShowKeluarModal] = useState(false)
  const [showBatalkanModal, setShowBatalkanModal] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  
  // Define canFullEdit based on currentUser roles
  const roles = currentUser?.roles || []
  const canFullEdit = roles.some((r: string) => ['super_admin', 'admin_tu'].includes(r))

  // State untuk Accordion Akademik (Otomatis buka kelas saat ini, atau kelas 10 jika belum ada)
  const [openAccordion, setOpenAccordion] = useState<number | null>(siswa.kelas?.tingkat || 10)
  const toggleAccordion = (val: number) => setOpenAccordion(prev => prev === val ? null : val)

  // 1. Kalkulasi Total Poin Pelanggaran & Credit Score
  const totalPoin = useMemo(() => {
    return pelanggaran.reduce((acc, curr) => acc + (curr.poin || curr.master_pelanggaran?.poin || 0), 0)
  }, [pelanggaran])

  const activeSanksi = useMemo(() => {
    if (!sanksiList || sanksiList.length === 0) return null
    return [...sanksiList].sort((a, b) => b.poin_minimal - a.poin_minimal).find(s => totalPoin >= s.poin_minimal) ?? null
  }, [totalPoin, sanksiList])

  const nextSanksi = useMemo(() => {
    if (!sanksiList || sanksiList.length === 0) return null
    const sorted = [...sanksiList].sort((a, b) => a.poin_minimal - b.poin_minimal)
    return sorted.find(s => s.poin_minimal > totalPoin) ?? null
  }, [totalPoin, sanksiList])

  const formatRupiah = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0)

  // 2. Format Kelas Saat Ini
  const namaKelasSekarang = siswa.kelas 
    ? formatNamaKelas(siswa.kelas.tingkat, siswa.kelas.nomor_kelas, siswa.kelas.kelompok)
    : 'Belum Ada Kelas'

  // 3. Helper untuk mendapatkan riwayat kelas berdasarkan tingkat
  const getClassStr = (tingkat: number) => {
    // Prioritaskan kelas saat ini jika tingkatnya cocok
    if (siswa.kelas && siswa.kelas.tingkat === tingkat) {
      return formatNamaKelas(siswa.kelas.tingkat, siswa.kelas.nomor_kelas, siswa.kelas.kelompok)
    }
    // Cari di riwayat jika tidak cocok
    const riwayat = riwayatKelas.find(r => r.kelas?.tingkat === tingkat)
    if (riwayat) {
      return formatNamaKelas(riwayat.kelas.tingkat, riwayat.kelas.nomor_kelas, riwayat.kelas.kelompok)
    }
    return `Belum ada data historis`
  }

  const getTahunAjaranStr = (tingkat: number) => {
    const riwayat = riwayatKelas.find(r => r.kelas?.tingkat === tingkat)
    return riwayat?.tahun_ajaran?.nama || '-'
  }

  // 4. Ekstrak Mapel Per Tingkat dari Rekap Nilai JSON
  const rna = siswa.rekap_nilai_akademik || {}
  const mapels10 = Array.from(new Set([...Object.keys(rna.nilai_smt1 || {}), ...Object.keys(rna.nilai_smt2 || {})])).sort()
  const mapels11 = Array.from(new Set([...Object.keys(rna.nilai_smt3 || {}), ...Object.keys(rna.nilai_smt4 || {})])).sort()
  const mapels12 = Array.from(new Set([...Object.keys(rna.nilai_smt5 || {}), ...Object.keys(rna.nilai_smt6 || {})])).sort()

  // Helper untuk warna inisial (fallback foto)
  const getAvatarColor = (name: string) => {
    const colors = ['from-emerald-400 to-teal-500', 'from-blue-400 to-indigo-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500']
    return colors[(name.charCodeAt(0) || 0) % colors.length]
  }

  // Komponen Label-Value Item untuk Biodata
  const DataItem = ({ label, value, className = '' }: { label: string, value: string | number | null, className?: string }) => (
    <div className={`flex flex-col border-b border-surface-2 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0 ${className}`}>
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{label}</span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 leading-snug">{value || '-'}</span>
    </div>
  )

  // ==============================================================
  // RENDERER ACCORDION AKADEMIK & NILAI
  // ==============================================================
  const renderAccordionItem = (
    tingkat: number, labelFase: string,
    titleSmt1: string, keySmt1: string,
    titleSmt2: string, keySmt2: string,
    mapels: string[]
  ) => {
    const classStr = getClassStr(tingkat)
    const taStr = getTahunAjaranStr(tingkat)
    const isOpen = openAccordion === tingkat
    const isNoData = classStr === 'Belum ada data historis' && mapels.length === 0

    return (
      <div className={`border rounded-lg overflow-hidden mb-3 transition-all duration-300 ${isOpen ? 'border-indigo-200 ring-2 ring-indigo-50' : 'border-surface bg-surface hover:border-indigo-200'}`}>
        <button
          onClick={() => toggleAccordion(tingkat)}
          className={`w-full flex items-center justify-between p-3 transition-colors ${isOpen ? 'bg-gradient-to-r from-indigo-50 to-white border-b border-indigo-100' : 'bg-surface'}`}
        >
          <div className="flex items-center gap-4">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-base shadow-sm transition-all duration-300 ${isOpen ? 'bg-indigo-600 text-white' : 'bg-surface-3 text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}>
              {tingkat}
            </div>
            <div className="text-left">
              <h4 className={`font-bold text-sm font-semibold leading-tight ${isOpen ? 'text-indigo-900' : 'text-slate-800 dark:text-slate-200 dark:text-slate-100'}`}>
                Kelas {classStr} <span className="text-xs font-semibold px-2 py-0.5 bg-surface border rounded-md ml-2 text-slate-500 dark:text-slate-400 dark:text-slate-500 hidden sm:inline-block">TA: {taStr}</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium mt-1">
                {labelFase} &bull; Rekap {titleSmt1} & {titleSmt2}
              </p>
            </div>
          </div>
          <div className={`p-2 rounded-full transition-transform duration-300 ${isOpen ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-surface-2 text-slate-400 dark:text-slate-500'}`}>
            <ChevronDown className="h-5 w-5" />
          </div>
        </button>

        {isOpen && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 animate-in slide-in-from-top-2 fade-in duration-300">
            {isNoData ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-surface rounded-xl border border-dashed border-surface">
                <LineChart className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-400 dark:text-slate-500" />
                <p className="font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Belum ada riwayat kelas dan nilai.</p>
                <p className="text-sm mt-1">Data akademik untuk tingkat {tingkat} belum diinputkan ke sistem.</p>
              </div>
            ) : mapels.length === 0 ? (
               <div className="text-center py-10 text-slate-400 dark:text-slate-500 bg-surface rounded-xl border border-surface-2">
                <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30 text-slate-400 dark:text-slate-500" />
                <p className="font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600">Riwayat Kelas Ada, tapi nilai kosong.</p>
                <p className="text-sm mt-1">Silakan import nilai dari RDM terlebih dahulu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar border border-surface rounded-xl sm:rounded-2xl bg-surface shadow-sm">
                <Table className="min-w-[500px]">
                  <TableHeader className="bg-slate-100 dark:bg-slate-800/80/80 border-b border-surface">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200 w-[50%] px-5">Mata Pelajaran</TableHead>
                      <TableHead className="font-extrabold text-indigo-800 text-center w-[25%] bg-indigo-50/50 border-l border-surface">{titleSmt1}</TableHead>
                      <TableHead className="font-extrabold text-emerald-800 dark:text-emerald-400 text-center w-[25%] bg-emerald-50 dark:bg-emerald-950/50/50 border-l border-surface">{titleSmt2}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapels.map(mp => (
                      <TableRow key={mp} className="hover:bg-surface-2 transition-colors">
                        <TableCell className="font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200 px-5 border-b border-surface-2">{mp}</TableCell>
                        <TableCell className="text-center font-mono font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 border-l border-b border-surface-2 bg-indigo-50/10">{rna[keySmt1]?.[mp] || '-'}</TableCell>
                        <TableCell className="text-center font-mono font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 border-l border-b border-surface-2 bg-emerald-50 dark:bg-emerald-950/50/10">{rna[keySmt2]?.[mp] || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Refresh handler after success actions
  const handleSuccess = () => {
    // Refresh the page to reflect changes (or use router.refresh() if using App Router)
    router.refresh()
    // Also close modals
    setShowKeluarModal(false)
    setShowBatalkanModal(false)
  }

  return (
    <div className="space-y-6">
      
      {/* EDIT MODAL */}
      <EditSiswaModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        siswa={siswa}
        kelasList={kelasList ?? []}
      />

      {/* HEADER PROFIL */}
      <div className="bg-surface rounded-xl p-5 sm:p-6 border border-surface shadow-sm flex flex-col lg:flex-row items-center lg:items-start gap-5 sm:gap-6">
        {/* FOTO PROFIL / INISIAL */}
        <div className="relative z-10 shrink-0">
          <div className="h-44 w-32 sm:h-48 sm:w-36 rounded-xl overflow-hidden border-2 border-white shadow-lg bg-surface-3">
            {siswa.foto_url ? (
              <img src={siswa.foto_url} alt={siswa.nama_lengkap} className="h-full w-full object-cover" />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${getAvatarColor(siswa.nama_lengkap)} flex items-center justify-center text-4xl font-black text-white`}>
                {siswa.nama_lengkap.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {activeSanksi && activeSanksi.urutan >= 3 && (
            <div className="absolute -bottom-2 -right-2 bg-rose-500 text-white p-2 rounded-full shadow-lg border-2 border-white animate-bounce" title="Siswa dalam pengawasan khusus">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* INFO UTAMA */}
        <div className="relative z-10 flex-1 text-center lg:text-left space-y-3 w-full">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50 tracking-tight">{siswa.nama_lengkap}</h1>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 font-mono mt-1">NISN: {siswa.nisn} {siswa.nis_lokal && `• NIS: ${siswa.nis_lokal}`}</p>
            </div>
            
            {/* BADGES + TOMBOL EDIT */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-2 items-center">
              <div className="flex flex-col items-center gap-0.5">
                <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${siswa.status === 'aktif' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : siswa.status === 'lulus' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                  {siswa.status}
                </span>
                {siswa.status === 'keluar' && siswa.tanggal_keluar && (
                  <span className="text-[10px] text-rose-500 font-medium">
                    {new Date(siswa.tanggal_keluar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
              <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-surface-3 text-slate-700 dark:text-slate-300 dark:text-slate-200 border border-surface shadow-sm flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Kelas {namaKelasSekarang}
              </span>
              {siswa.tempat_tinggal !== 'Non-Pesantren' && (
                 <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200 shadow-sm flex items-center gap-1.5">
                   <MapPin className="h-3.5 w-3.5" /> {siswa.asrama ? `${siswa.asrama}${siswa.kamar ? ` · ${siswa.kamar}` : ''}` : 'Anak Pesantren'}
                 </span>
              )}
              <Button
                onClick={() => setIsEditOpen(true)}
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Biodata
              </Button>
              {canFullEdit && siswa.status === 'aktif' && (
                <Button
                  onClick={() => setShowKeluarModal(true)}
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 text-xs font-semibold border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" /> Tandai Keluar
                </Button>
              )}
              {canFullEdit && siswa.status === 'keluar' && (
                <Button
                  onClick={() => setShowBatalkanModal(true)}
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 text-xs font-semibold border-amber-200 text-amber-600 hover:bg-amber-50 gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Batalkan Keluar
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 flex justify-center lg:justify-start items-center gap-2 pt-1">
            <User className="h-4 w-4 text-slate-400 dark:text-slate-500" /> {siswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <Phone className="h-4 w-4 text-slate-400 dark:text-slate-500" /> {siswa.nomor_whatsapp || 'Belum ada nomor WA'}
          </p>
        </div>
      </div>

      {/* TABS SUPER LENGKAP */}
      <Tabs defaultValue={initialTab} className="w-full">
        <div className="pb-2">
          {/* TAB DIPERSEDIKIT MENJADI 4 */}
          <TabsList className="bg-surface border border-surface p-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 w-full h-auto rounded-lg gap-1">
            <TabsTrigger value="biodata" className="w-full py-2 px-2 rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-medium gap-1.5"><User className="h-4 w-4"/> Biodata Lengkap</TabsTrigger>
            <TabsTrigger value="akademik_nilai" className="w-full py-2 px-2 rounded-md data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-medium gap-1.5"><GraduationCap className="h-4 w-4"/> Akademik & Nilai</TabsTrigger>
            <TabsTrigger value="disiplin" className="w-full py-2 px-2 rounded-md data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs font-medium gap-1.5 relative">
              <ShieldAlert className="h-4 w-4"/> Tata Tertib
              {totalPoin > 0 && <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>}
            </TabsTrigger>
            <TabsTrigger value="izin" className="w-full py-2 px-2 rounded-md data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs font-medium gap-1.5"><DoorOpen className="h-4 w-4"/> Perizinan</TabsTrigger>
            <TabsTrigger value="absensi" className="w-full py-2 px-2 rounded-md data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-xs font-medium gap-1.5"><CalendarSearch className="h-4 w-4"/> Rekap Absensi</TabsTrigger>
            <TabsTrigger value="keuangan" className="w-full py-2 px-2 rounded-md data-[state=active]:bg-emerald-700 data-[state=active]:text-white text-xs font-medium gap-1.5"><Wallet className="h-4 w-4"/> Keuangan</TabsTrigger>
          </TabsList>
        </div>

        {/* ======================= TAB 1: BIODATA ======================= */}
        <TabsContent value="biodata" className="mt-4 space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Kartu 1: Data Pribadi */}
            <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 border-b border-surface-2 pb-4 mb-4 flex items-center gap-2"><User className="text-emerald-600 h-5 w-5"/> Data Pribadi Siswa</h3>
              <DataItem label="NIK" value={siswa.nik} />
              <DataItem label="Tempat, Tanggal Lahir" value={`${siswa.tempat_lahir || '-'}, ${siswa.tanggal_lahir ? new Date(siswa.tanggal_lahir).toLocaleDateString('id-ID') : '-'}`} />
              <DataItem label="Agama" value={siswa.agama} />
              <div className="grid grid-cols-2 gap-4">
                <DataItem label="Anak Ke" value={siswa.anak_ke} />
                <DataItem label="Jml Saudara" value={siswa.jumlah_saudara} />
              </div>
              <DataItem label="Status Anak" value={siswa.status_anak} />
            </div>

            {/* Kartu 2: Tempat Tinggal */}
            <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 border-b border-surface-2 pb-4 mb-4 flex items-center gap-2"><MapPin className="text-blue-600 h-5 w-5"/> Domisili & Alamat</h3>
              <DataItem label="Status Domisili / Pesantren" value={siswa.tempat_tinggal} className="bg-blue-50/50 p-3 rounded-xl border border-blue-100" />
              {siswa.tempat_tinggal !== 'Non-Pesantren' && (
                <div className="grid grid-cols-2 gap-4 bg-orange-50/60 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 p-3 rounded-xl mb-3">
                  <DataItem label="Asrama" value={siswa.asrama} />
                  <DataItem label="Kamar" value={siswa.kamar} />
                </div>
              )}
              <DataItem label="Alamat Lengkap (Jalan/Kp)" value={siswa.alamat_lengkap} />
              <div className="grid grid-cols-2 gap-4">
                <DataItem label="RT" value={siswa.rt} />
                <DataItem label="RW" value={siswa.rw} />
              </div>
              <DataItem label="Desa / Kelurahan" value={siswa.desa_kelurahan} />
              <DataItem label="Kecamatan" value={siswa.kecamatan} />
              <DataItem label="Kabupaten / Kota" value={siswa.kabupaten_kota} />
            </div>

            {/* Kartu 3: Data Orang Tua */}
            <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface xl:col-span-1 md:col-span-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 border-b border-surface-2 pb-4 mb-4 flex items-center gap-2"><Users className="text-orange-600 h-5 w-5"/> Data Orang Tua / Wali</h3>
              <DataItem label="Nomor Kartu Keluarga (KK)" value={siswa.nomor_kk} className="bg-orange-50/50 p-3 rounded-xl border border-orange-100" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 mt-4">
                <div className="border border-surface-2 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200 mb-3">Data Ayah</h4>
                  <DataItem label="Nama Ayah" value={siswa.nama_ayah} />
                  <DataItem label="Status" value={siswa.status_ayah} />
                  <DataItem label="Pekerjaan" value={siswa.pekerjaan_ayah} />
                  <DataItem label="Penghasilan" value={siswa.penghasilan_ayah} />
                </div>
                <div className="border border-surface-2 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200 mb-3">Data Ibu</h4>
                  <DataItem label="Nama Ibu" value={siswa.nama_ibu} />
                  <DataItem label="Status" value={siswa.status_ibu} />
                  <DataItem label="Pekerjaan" value={siswa.pekerjaan_ibu} />
                  <DataItem label="Penghasilan" value={siswa.penghasilan_ibu} />
                </div>
              </div>
            </div>

          </div>
        </TabsContent>

        {/* ======================= TAB 2: AKADEMIK & NILAI (GABUNGAN BARU) ======================= */}
        <TabsContent value="akademik_nilai" className="mt-4 animate-in fade-in">
          <div className="w-full space-y-2">
            {/* RENDER ACCORDION UNTUK KELAS 10, 11, 12 */}
            {renderAccordionItem(10, 'Kelas 10', 'Semester 1', 'nilai_smt1', 'Semester 2', 'nilai_smt2', mapels10)}
            {renderAccordionItem(11, 'Kelas 11', 'Semester 3', 'nilai_smt3', 'Semester 4', 'nilai_smt4', mapels11)}
            {renderAccordionItem(12, 'Kelas 12', 'Semester 5', 'nilai_smt5', 'Semester 6', 'nilai_smt6', mapels12)}

          </div>
        </TabsContent>

        {/* ======================= TAB 3: KEDISIPLINAN ======================= */}
        <TabsContent value="disiplin" className="mt-4 space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Sanksi Status */}
            <div className={`p-4 rounded-xl border md:col-span-1 flex flex-col items-center justify-center text-center gap-3
              ${activeSanksi
                ? activeSanksi.urutan >= 3 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  : activeSanksi.urutan === 2 ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
                  : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'}`}>

              {/* Poin counter */}
              <div className="flex flex-col items-center justify-center h-24 w-24 rounded-full border-4
                border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30">
                <span className="text-3xl font-black text-rose-600 dark:text-rose-400 leading-none">{totalPoin}</span>
                <span className="text-[9px] text-rose-400 dark:text-rose-600 font-bold uppercase tracking-wide mt-0.5">poin</span>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status Kedisiplinan</p>
                <p className={`text-sm font-black mt-1 px-3 py-1 rounded-full inline-flex items-center gap-1
                  ${activeSanksi
                    ? activeSanksi.urutan >= 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                      : activeSanksi.urutan === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-400'}`}>
                  {activeSanksi
                    ? <><ShieldAlert className="h-3.5 w-3.5" />{activeSanksi.nama}</>
                    : <><ShieldCheck className="h-3.5 w-3.5" />Baik</>}
                </p>
                {activeSanksi?.deskripsi && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 italic">{activeSanksi.deskripsi}</p>
                )}
                {nextSanksi && (
                  <div className="mt-2 w-full">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1">
                      Menuju <strong>{nextSanksi.nama}</strong> @ {nextSanksi.poin_minimal} poin
                    </p>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full rounded-full bg-rose-400 transition-all"
                        style={{ width: `${Math.min(100, (totalPoin / nextSanksi.poin_minimal) * 100)}%` }} />
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  {pelanggaran.length} kasus tercatat
                </p>
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-surface md:col-span-2 overflow-hidden flex flex-col h-80">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 dark:text-slate-100 px-3 py-2.5 border-b bg-surface-2 flex items-center gap-2">
                <History className="h-5 w-5 text-slate-500 dark:text-slate-400 dark:text-slate-500"/> Riwayat Pelanggaran Tercatat
              </h3>
              <ScrollArea className="flex-1">
                {pelanggaran.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 p-8">
                    <CheckCircle2 className="h-12 w-12 text-emerald-200 mb-2" />
                    <p>Belum ada catatan pelanggaran.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {pelanggaran.map(p => (
                      <div key={p.id} className="p-4 hover:bg-surface-2 transition-colors flex gap-4">
                        <div className="shrink-0 flex flex-col items-center justify-center h-12 w-12 bg-rose-100 rounded-2xl text-rose-600 font-black border border-rose-200 shadow-sm">
                          +{p.master_pelanggaran?.poin}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100 text-sm">{p.master_pelanggaran?.nama_pelanggaran}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{new Date(p.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          {p.keterangan && <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 italic mt-1.5 bg-surface-3 p-2 rounded-lg">"{p.keterangan}"</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Pelapor: {p.pelapor?.nama_lengkap}</span>
                            {p.foto_url && <a href={p.foto_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-blue-100"><ImageIcon className="h-3 w-3"/> Bukti Foto</a>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        {/* ======================= TAB 4: PERIZINAN ======================= */}
        <TabsContent value="izin" className="mt-4 space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* IZIN KELUAR KOMPLEK */}
            <div className="bg-surface rounded-lg border border-surface overflow-hidden flex flex-col h-96">
              <div className="p-4 border-b bg-blue-50/50 flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">Riwayat Keluar Komplek</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {izinKeluar.length === 0 ? <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-10">Tidak ada riwayat izin keluar komplek.</p> : (
                  <div className="space-y-3">
                    {izinKeluar.map(k => (
                      <div key={k.id} className="border border-surface rounded-lg p-2.5 hover:border-blue-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">{new Date(k.waktu_keluar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${k.status === 'BELUM KEMBALI' ? 'bg-amber-100 text-amber-700' : 'bg-surface-3 text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600'}`}>{k.status}</span>
                        </div>
                        <div className="flex gap-4 mb-2">
                          <div className="flex-1 bg-surface-2 p-2 rounded-xl text-center border border-surface-2">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Jam Keluar</p>
                            <p className="font-mono font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200">{formatTimeWIB(k.waktu_keluar, { suffix: false })}</p>
                          </div>
                          <div className="flex-1 bg-surface-2 p-2 rounded-xl text-center border border-surface-2">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Jam Kembali</p>
                            <p className="font-mono font-bold text-slate-700 dark:text-slate-300 dark:text-slate-200">{k.waktu_kembali ? formatTimeWIB(k.waktu_kembali, { suffix: false }) : '-'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 line-clamp-2"><span className="font-semibold text-slate-400 dark:text-slate-500">Ket:</span> {k.keterangan || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* KETERANGAN TIDAK HADIR SEKOLAH */}
            <div className="bg-surface rounded-lg border border-surface overflow-hidden flex flex-col h-96">
              <div className="p-4 border-b bg-emerald-50/50 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">Riwayat Keterangan Tidak Hadir</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {keteranganWaliKelas.length === 0 ? <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-10">Belum ada keterangan tidak hadir dari wali kelas.</p> : (
                  <div className="space-y-3">
                    {keteranganWaliKelas.map(k => (
                      <div key={k.id} className="border border-surface rounded-lg p-3 relative overflow-hidden hover:border-emerald-300 transition-colors">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${k.status === 'SAKIT' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                        <div className="pl-3">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${k.status === 'SAKIT' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{k.status}</span>
                          </div>
                          {k.keterangan && <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{k.keterangan}"</p>}
                          <p className="text-[10px] text-slate-400 mt-2">Input oleh: {k.input_nama || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* IZIN KELAS */}
            <div className="bg-surface rounded-lg border border-surface overflow-hidden flex flex-col h-96">
              <div className="p-4 border-b bg-indigo-50/50 flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">Riwayat Izin Tidak Masuk Kelas</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {izinKelas.length === 0 ? <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-10">Tidak ada riwayat izin jam pelajaran.</p> : (
                  <div className="space-y-3">
                    {izinKelas.map(k => (
                      <div key={k.id} className="border border-surface rounded-lg p-2.5 relative overflow-hidden hover:border-indigo-300 transition-colors">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                        <div className="pl-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">{new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                              {(Array.isArray(k.jam_pelajaran) ? k.jam_pelajaran : []).map((j: number) => <span key={j} className="h-5 w-5 bg-indigo-100 text-indigo-700 rounded-md flex items-center justify-center text-[10px] font-black border border-indigo-200">{j}</span>)}
                            </div>
                          </div>
                          <p className="text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-1 bg-indigo-50 w-fit px-2 py-0.5 rounded">{k.alasan}</p>
                          {k.keterangan && <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-300 dark:text-slate-600 italic">"{k.keterangan}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

          </div>
        </TabsContent>

        {/* ======================= TAB 5: REKAP ABSENSI ======================= */}
        <TabsContent value="absensi" className="mt-4 animate-in fade-in">
          <RekapAbsensiTab siswaId={siswa.id} siswa={siswa} />
        </TabsContent>

        {/* ======================= TAB 6: KEUANGAN ======================= */}
        <TabsContent value="keuangan" className="mt-4 space-y-4 animate-in fade-in">
          {(() => {
            const dspt = keuangan?.dspt
            const sppAwal = keuangan?.sppSaldoAwal
            const transaksi = keuangan?.transaksi || []
            const dsptTarget = dspt?.nominal_target || 0
            const dsptTerbayar = (dspt?.total_dibayar || 0) + (dspt?.total_diskon || 0)
            const dsptSisa = Math.max(0, dsptTarget - dsptTerbayar)
            const sppTotal = sppAwal?.jumlah || 0
            const sppDibayar = sppAwal?.total_dibayar || 0
            const sppSisa = Math.max(0, sppTotal - sppDibayar)
            const trxAktif = transaksi.filter((t: any) => !t.is_void)
            const totalPembayaran = trxAktif.reduce((acc: number, t: any) => acc + (t.jumlah_total || 0), 0)

            return (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="bg-surface rounded-lg border border-surface overflow-hidden flex flex-col h-80">
                    <div className="p-4 border-b bg-blue-50/60 flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-blue-600" />
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">DSPT</h3>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                      <div className="bg-surface-2 rounded-lg border border-surface-2 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Target</p>
                        <p className="text-lg font-black text-slate-800 mt-1">{formatRupiah(dsptTarget)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                          <p className="text-[10px] uppercase text-emerald-700 font-bold">Terpenuhi</p>
                          <p className="text-sm font-bold text-emerald-700 mt-1">{formatRupiah(dsptTerbayar)}</p>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                          <p className="text-[10px] uppercase text-rose-700 font-bold">Sisa</p>
                          <p className="text-sm font-bold text-rose-700 mt-1">{formatRupiah(dsptSisa)}</p>
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${dsptTarget > 0 ? Math.min(100, Math.round((dsptTerbayar / dsptTarget) * 100)) : 0}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {dsptTarget > 0 ? Math.min(100, Math.round((dsptTerbayar / dsptTarget) * 100)) : 0}% terpenuhi
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface rounded-lg border border-surface overflow-hidden flex flex-col h-80">
                    <div className="p-4 border-b bg-amber-50/60 flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-amber-600" />
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">SPP Tunggakan Awal</h3>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                      <div className="bg-surface-2 rounded-lg border border-surface-2 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Total Tunggakan</p>
                        <p className="text-lg font-black text-slate-800 mt-1">{formatRupiah(sppTotal)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                          <p className="text-[10px] uppercase text-emerald-700 font-bold">Dibayar</p>
                          <p className="text-sm font-bold text-emerald-700 mt-1">{formatRupiah(sppDibayar)}</p>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5">
                          <p className="text-[10px] uppercase text-rose-700 font-bold">Sisa</p>
                          <p className="text-sm font-bold text-rose-700 mt-1">{formatRupiah(sppSisa)}</p>
                        </div>
                      </div>
                      <div className="pt-1">
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${sppTotal > 0 ? Math.min(100, Math.round((sppDibayar / sppTotal) * 100)) : 0}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {sppTotal > 0 ? Math.min(100, Math.round((sppDibayar / sppTotal) * 100)) : 0}% terbayar
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface rounded-lg border border-surface overflow-hidden flex flex-col h-80">
                    <div className="p-4 border-b bg-emerald-50/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 dark:text-slate-100">Riwayat Transaksi</h3>
                      </div>
                      <Link href={`/dashboard/keuangan/siswa/${siswa.id}?tab=riwayat`} className="text-[11px] font-semibold text-emerald-700 hover:underline">
                        Buka Detail Keuangan
                      </Link>
                    </div>
                    <div className="px-4 pt-3 pb-2">
                      <p className="text-[11px] text-slate-500">
                        Total pembayaran sah: <span className="font-bold text-emerald-700">{formatRupiah(totalPembayaran)}</span> · {trxAktif.length} transaksi
                      </p>
                    </div>
                    <ScrollArea className="flex-1 px-4 pb-3">
                      {transaksi.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-400">Belum ada transaksi keuangan untuk siswa ini.</div>
                      ) : (
                        <div className="space-y-2">
                          {transaksi.slice(0, 8).map((t: any) => (
                            <div key={t.id} className="border border-surface rounded-lg p-2.5 flex items-center justify-between gap-3 hover:border-emerald-200 transition-colors">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate">
                                  {t.nomor_kuitansi || '-'} · {String(t.kategori || '-').toUpperCase()}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.metode_bayar === 'tunai' ? 'Tunai' : 'Transfer'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-xs font-bold ${t.is_void ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                                  {formatRupiah(t.jumlah_total || 0)}
                                </p>
                                <p className={`text-[10px] font-semibold ${t.is_void ? 'text-rose-500' : 'text-emerald-600'}`}>
                                  {t.is_void ? 'VOID' : 'SAH'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>

                {!dspt && !sppAwal && transaksi.length === 0 && (
                  <div className="text-center py-8 bg-surface border border-dashed border-surface rounded-xl text-slate-400 text-sm">
                    Data keuangan siswa ini belum tersedia.
                  </div>
                )}
              </>
            )
          })()}
        </TabsContent>

      </Tabs>

      {/* Modal Tandai Keluar & Batalkan Keluar */}
      <TandaiKeluarModal
        isOpen={showKeluarModal}
        siswaId={siswa.id}
        namaSiswa={siswa.nama_lengkap}
        onSuccess={handleSuccess}
        onClose={() => setShowKeluarModal(false)}
      />
      <BatalkanKeluarModal
        isOpen={showBatalkanModal}
        siswaId={siswa.id}
        namaSiswa={siswa.nama_lengkap}
        onSuccess={handleSuccess}
        onClose={() => setShowBatalkanModal(false)}
      />
    </div>
  )
}

