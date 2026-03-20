// Lokasi: app/dashboard/siswa/[id]/components/detail-client.tsx
'use client'

import { useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { 
  User, GraduationCap, ShieldAlert, DoorOpen, LineChart, 
  MapPin, Phone, Users, CheckCircle2, History, AlertTriangle, 
  Image as ImageIcon, ChevronDown, ChevronUp, BookOpen, Pencil
} from 'lucide-react'
import { EditSiswaModal } from '../../components/edit-modal'

export function DetailSiswaClient({ 
  siswa, riwayatKelas, pelanggaran, izinKeluar, izinKelas, kelasList
}: { 
  siswa: any, riwayatKelas: any[], pelanggaran: any[], izinKeluar: any[], izinKelas: any[]
  kelasList?: any[]
}) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  
  // State untuk Accordion Akademik (Otomatis buka kelas saat ini, atau kelas 10 jika belum ada)
  const [openAccordion, setOpenAccordion] = useState<number | null>(siswa.kelas?.tingkat || 10)
  const toggleAccordion = (val: number) => setOpenAccordion(prev => prev === val ? null : val)

  // 1. Kalkulasi Total Poin Pelanggaran
  const totalPoin = useMemo(() => {
    return pelanggaran.reduce((acc, curr) => acc + (curr.master_pelanggaran?.poin || 0), 0)
  }, [pelanggaran])

  // 2. Format Kelas Saat Ini
  const namaKelasSekarang = siswa.kelas 
    ? `${siswa.kelas.tingkat}-${siswa.kelas.nomor_kelas} ${siswa.kelas.kelompok !== 'UMUM' ? siswa.kelas.kelompok : ''}`.trim() 
    : 'Belum Ada Kelas'

  // 3. Helper untuk mendapatkan riwayat kelas berdasarkan tingkat
  const getClassStr = (tingkat: number) => {
    // Prioritaskan kelas saat ini jika tingkatnya cocok
    if (siswa.kelas && siswa.kelas.tingkat === tingkat) {
      return `${siswa.kelas.tingkat}-${siswa.kelas.nomor_kelas} ${siswa.kelas.kelompok !== 'UMUM' ? siswa.kelas.kelompok : ''}`.trim()
    }
    // Cari di riwayat jika tidak cocok
    const riwayat = riwayatKelas.find(r => r.kelas?.tingkat === tingkat)
    if (riwayat) {
      return `${riwayat.kelas.tingkat}-${riwayat.kelas.nomor_kelas} ${riwayat.kelas.kelompok !== 'UMUM' ? riwayat.kelas.kelompok : ''}`.trim()
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
  const mapels12 = Array.from(new Set([...Object.keys(rna.nilai_smt5 || {}), ...Object.keys(rna.nilai_um || {})])).sort()

  // Helper untuk warna inisial (fallback foto)
  const getAvatarColor = (name: string) => {
    const colors = ['from-emerald-400 to-teal-500', 'from-blue-400 to-indigo-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500']
    return colors[(name.charCodeAt(0) || 0) % colors.length]
  }

  // Komponen Label-Value Item untuk Biodata
  const DataItem = ({ label, value, className = '' }: { label: string, value: string | number | null, className?: string }) => (
    <div className={`flex flex-col border-b border-surface-2 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0 ${className}`}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</span>
      <span className="text-sm font-semibold text-slate-800 leading-snug">{value || '-'}</span>
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
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-base shadow-sm transition-all duration-300 ${isOpen ? 'bg-indigo-600 text-white' : 'bg-surface-3 text-slate-500'}`}>
              {tingkat}
            </div>
            <div className="text-left">
              <h4 className={`font-bold text-sm font-semibold leading-tight ${isOpen ? 'text-indigo-900' : 'text-slate-800'}`}>
                Kelas {classStr} <span className="text-xs font-semibold px-2 py-0.5 bg-surface border rounded-md ml-2 text-slate-500 hidden sm:inline-block">TA: {taStr}</span>
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                {labelFase} &bull; Rekap {titleSmt1} & {titleSmt2}
              </p>
            </div>
          </div>
          <div className={`p-2 rounded-full transition-transform duration-300 ${isOpen ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-surface-2 text-slate-400'}`}>
            <ChevronDown className="h-5 w-5" />
          </div>
        </button>

        {isOpen && (
          <div className="p-3 bg-slate-50/50 animate-in slide-in-from-top-2 fade-in duration-300">
            {isNoData ? (
              <div className="text-center py-12 text-slate-400 bg-surface rounded-xl border border-dashed border-surface">
                <LineChart className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-400" />
                <p className="font-medium text-slate-600">Belum ada riwayat kelas dan nilai.</p>
                <p className="text-sm mt-1">Data akademik untuk tingkat {tingkat} belum diinputkan ke sistem.</p>
              </div>
            ) : mapels.length === 0 ? (
               <div className="text-center py-10 text-slate-400 bg-surface rounded-xl border border-surface-2">
                <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30 text-slate-400" />
                <p className="font-medium text-slate-600">Riwayat Kelas Ada, tapi nilai kosong.</p>
                <p className="text-sm mt-1">Silakan import nilai dari RDM terlebih dahulu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar border border-surface rounded-xl sm:rounded-2xl bg-surface shadow-sm">
                <Table className="min-w-[500px]">
                  <TableHeader className="bg-slate-100/80 border-b border-surface">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 w-[50%] px-5">Mata Pelajaran</TableHead>
                      <TableHead className="font-extrabold text-indigo-800 text-center w-[25%] bg-indigo-50/50 border-l border-surface">{titleSmt1}</TableHead>
                      <TableHead className="font-extrabold text-emerald-800 text-center w-[25%] bg-emerald-50/50 border-l border-surface">{titleSmt2}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapels.map(mp => (
                      <TableRow key={mp} className="hover:bg-surface-2 transition-colors">
                        <TableCell className="font-semibold text-slate-700 px-5 border-b border-surface-2">{mp}</TableCell>
                        <TableCell className="text-center font-mono font-medium text-slate-600 border-l border-b border-surface-2 bg-indigo-50/10">{rna[keySmt1]?.[mp] || '-'}</TableCell>
                        <TableCell className="text-center font-mono font-medium text-slate-600 border-l border-b border-surface-2 bg-emerald-50/10">{rna[keySmt2]?.[mp] || '-'}</TableCell>
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
      <div className="bg-surface rounded-xl p-4 border border-surface shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
        {/* Dekorasi Latar */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -z-0 opacity-50"></div>
        <div className="absolute left-0 bottom-0 w-32 h-32 bg-blue-50 rounded-full blur-2xl -z-0 opacity-50"></div>
        
        {/* FOTO PROFIL / INISIAL */}
        <div className="relative z-10 shrink-0">
          <div className={`h-20 w-20 rounded-full bg-gradient-to-br ${getAvatarColor(siswa.nama_lengkap)} shadow-lg flex items-center justify-center text-2xl font-black text-white border-4 border-white`}>
            {siswa.nama_lengkap.charAt(0).toUpperCase()}
          </div>
          {totalPoin >= 50 && (
            <div className="absolute -bottom-2 -right-2 bg-rose-500 text-white p-2 rounded-full shadow-lg border-2 border-white animate-bounce" title="Siswa dalam pengawasan khusus (SP)">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
        </div>

        {/* INFO UTAMA */}
        <div className="relative z-10 flex-1 text-center md:text-left space-y-2 w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">{siswa.nama_lengkap}</h1>
              <p className="text-sm font-bold text-slate-500 font-mono mt-1">NISN: {siswa.nisn} {siswa.nis_lokal && `• NIS: ${siswa.nis_lokal}`}</p>
            </div>
            
            {/* BADGES + TOMBOL EDIT */}
            <div className="flex flex-wrap justify-center md:justify-end gap-2 items-center">
              <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${siswa.status === 'aktif' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : siswa.status === 'lulus' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                {siswa.status}
              </span>
              <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-surface-3 text-slate-700 border border-surface shadow-sm flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> Kelas {namaKelasSekarang}
              </span>
              {siswa.tempat_tinggal !== 'Non-Pesantren' && (
                 <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200 shadow-sm flex items-center gap-1.5">
                   <MapPin className="h-3.5 w-3.5" /> Anak Asrama
                 </span>
              )}
              <Button
                onClick={() => setIsEditOpen(true)}
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs font-semibold border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit Biodata
              </Button>
            </div>
          </div>
          
          <p className="text-sm font-medium text-slate-600 flex justify-center md:justify-start items-center gap-2 pt-2">
            <User className="h-4 w-4 text-slate-400" /> {siswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
            <span className="text-slate-300">|</span>
            <Phone className="h-4 w-4 text-slate-400" /> {siswa.nomor_whatsapp || 'Belum ada nomor WA'}
          </p>
        </div>
      </div>

      {/* TABS SUPER LENGKAP */}
      <Tabs defaultValue="biodata" className="w-full">
        <div className="overflow-x-auto custom-scrollbar pb-2">
          {/* TAB DIPERSEDIKIT MENJADI 4 */}
          <TabsList className="bg-surface border border-surface p-0.5 flex w-max min-w-full h-auto rounded-lg">
            <TabsTrigger value="biodata" className="py-2 px-3 rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs font-medium flex-1 gap-1.5"><User className="h-4 w-4"/> Biodata Lengkap</TabsTrigger>
            <TabsTrigger value="akademik_nilai" className="py-2 px-3 rounded-md data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs font-medium flex-1 gap-1.5"><GraduationCap className="h-4 w-4"/> Akademik & Nilai</TabsTrigger>
            <TabsTrigger value="disiplin" className="py-2 px-3 rounded-md data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs font-medium flex-1 gap-1.5 relative">
              <ShieldAlert className="h-4 w-4"/> Tata Tertib
              {totalPoin > 0 && <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>}
            </TabsTrigger>
            <TabsTrigger value="izin" className="py-2 px-3 rounded-md data-[state=active]:bg-orange-500 data-[state=active]:text-white text-xs font-medium flex-1 gap-1.5"><DoorOpen className="h-4 w-4"/> Perizinan</TabsTrigger>
          </TabsList>
        </div>

        {/* ======================= TAB 1: BIODATA ======================= */}
        <TabsContent value="biodata" className="mt-4 space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            
            {/* Kartu 1: Data Pribadi */}
            <div className="bg-surface p-4 rounded-lg shadow-sm border border-surface">
              <h3 className="text-lg font-bold text-slate-800 border-b border-surface-2 pb-4 mb-4 flex items-center gap-2"><User className="text-emerald-600 h-5 w-5"/> Data Pribadi Siswa</h3>
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
              <h3 className="text-lg font-bold text-slate-800 border-b border-surface-2 pb-4 mb-4 flex items-center gap-2"><MapPin className="text-blue-600 h-5 w-5"/> Domisili & Alamat</h3>
              <DataItem label="Status Domisili / Pesantren" value={siswa.tempat_tinggal} className="bg-blue-50/50 p-3 rounded-xl border border-blue-100" />
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
              <h3 className="text-lg font-bold text-slate-800 border-b border-surface-2 pb-4 mb-4 flex items-center gap-2"><Users className="text-orange-600 h-5 w-5"/> Data Orang Tua / Wali</h3>
              <DataItem label="Nomor Kartu Keluarga (KK)" value={siswa.nomor_kk} className="bg-orange-50/50 p-3 rounded-xl border border-orange-100" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6 mt-4">
                <div className="border border-surface-2 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="font-bold text-slate-700 mb-3">Data Ayah</h4>
                  <DataItem label="Nama Ayah" value={siswa.nama_ayah} />
                  <DataItem label="Status" value={siswa.status_ayah} />
                  <DataItem label="Pekerjaan" value={siswa.pekerjaan_ayah} />
                  <DataItem label="Penghasilan" value={siswa.penghasilan_ayah} />
                </div>
                <div className="border border-surface-2 rounded-xl p-4 bg-slate-50/50">
                  <h4 className="font-bold text-slate-700 mb-3">Data Ibu</h4>
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
          <div className="max-w-4xl mx-auto space-y-2">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-6 gap-2">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <LineChart className="text-indigo-600 h-6 w-6"/> Histori Penempatan & Nilai
                </h3>
                <p className="text-slate-500 text-sm mt-1">Klik pada masing-masing tingkat kelas untuk melihat rekapitulasi nilai semester.</p>
              </div>
              <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg shadow-sm w-fit">
                Berdasarkan Data RDM
              </div>
            </div>

            {/* RENDER ACCORDION UNTUK KELAS 10, 11, 12 */}
            {renderAccordionItem(10, 'Fase E (Umum)', 'Semester 1', 'nilai_smt1', 'Semester 2', 'nilai_smt2', mapels10)}
            {renderAccordionItem(11, 'Fase F (Penjurusan)', 'Semester 3', 'nilai_smt3', 'Semester 4', 'nilai_smt4', mapels11)}
            {renderAccordionItem(12, 'Fase F (Akhir)', 'Semester 5', 'nilai_smt5', 'Ujian Madrasah (UM)', 'nilai_um', mapels12)}

          </div>
        </TabsContent>

        {/* ======================= TAB 3: KEDISIPLINAN ======================= */}
        <TabsContent value="disiplin" className="mt-4 space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-4 rounded-lg border md:col-span-1 flex flex-col items-center justify-center text-center ${totalPoin >= 50 ? 'bg-rose-50 border-rose-200' : totalPoin >= 20 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className="text-sm font-bold uppercase tracking-wider mb-2 text-slate-500">Total Credit Point</p>
              <h2 className={`text-5xl font-black ${totalPoin >= 50 ? 'text-rose-600 animate-pulse' : totalPoin >= 20 ? 'text-amber-600' : 'text-emerald-600'}`}>{totalPoin}</h2>
              {totalPoin >= 50 && <p className="mt-2 text-xs font-medium text-white bg-rose-600 px-3 py-1.5 rounded-lg shadow-md">PERINGATAN: Memenuhi Syarat SP / Panggilan Orang Tua</p>}
              {totalPoin === 0 && <p className="mt-4 text-sm font-bold text-emerald-700"><CheckCircle2 className="inline h-5 w-5 mb-1"/> Bersih dari pelanggaran</p>}
            </div>

            <div className="bg-surface rounded-lg border border-surface md:col-span-2 overflow-hidden flex flex-col h-80">
              <h3 className="text-sm font-semibold text-slate-800 px-3 py-2.5 border-b bg-surface-2 flex items-center gap-2">
                <History className="h-5 w-5 text-slate-500"/> Riwayat Pelanggaran Tercatat
              </h3>
              <ScrollArea className="flex-1">
                {pelanggaran.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
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
                          <h4 className="font-bold text-slate-800 text-sm">{p.master_pelanggaran?.nama_pelanggaran}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(p.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          {p.keterangan && <p className="text-xs text-slate-600 italic mt-1.5 bg-surface-3 p-2 rounded-lg">"{p.keterangan}"</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Pelapor: {p.pelapor?.nama_lengkap}</span>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* IZIN KELUAR KOMPLEK */}
            <div className="bg-surface rounded-lg border border-surface overflow-hidden flex flex-col h-96">
              <div className="p-4 border-b bg-blue-50/50 flex items-center gap-2">
                <DoorOpen className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-800">Riwayat Keluar Komplek</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {izinKeluar.length === 0 ? <p className="text-center text-sm text-slate-400 mt-10">Tidak ada riwayat izin keluar komplek.</p> : (
                  <div className="space-y-3">
                    {izinKeluar.map(k => (
                      <div key={k.id} className="border border-surface rounded-lg p-2.5 hover:border-blue-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-bold text-slate-500">{new Date(k.waktu_keluar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${k.status === 'BELUM KEMBALI' ? 'bg-amber-100 text-amber-700' : 'bg-surface-3 text-slate-600'}`}>{k.status}</span>
                        </div>
                        <div className="flex gap-4 mb-2">
                          <div className="flex-1 bg-surface-2 p-2 rounded-xl text-center border border-surface-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Jam Keluar</p>
                            <p className="font-mono font-bold text-slate-700">{new Date(k.waktu_keluar).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className="flex-1 bg-surface-2 p-2 rounded-xl text-center border border-surface-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Jam Kembali</p>
                            <p className="font-mono font-bold text-slate-700">{k.waktu_kembali ? new Date(k.waktu_kembali).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2"><span className="font-semibold text-slate-400">Ket:</span> {k.keterangan || '-'}</p>
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
                <h3 className="font-bold text-slate-800">Riwayat Izin Tidak Masuk Kelas</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {izinKelas.length === 0 ? <p className="text-center text-sm text-slate-400 mt-10">Tidak ada riwayat izin jam pelajaran.</p> : (
                  <div className="space-y-3">
                    {izinKelas.map(k => (
                      <div key={k.id} className="border border-surface rounded-lg p-2.5 relative overflow-hidden hover:border-indigo-300 transition-colors">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500"></div>
                        <div className="pl-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold text-slate-500">{new Date(k.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <div className="flex gap-1 flex-wrap justify-end max-w-[50%]">
                              {k.jam_pelajaran.map((j: number) => <span key={j} className="h-5 w-5 bg-indigo-100 text-indigo-700 rounded-md flex items-center justify-center text-[10px] font-black border border-indigo-200">{j}</span>)}
                            </div>
                          </div>
                          <p className="text-[11px] font-black text-indigo-700 uppercase tracking-wider mb-1 bg-indigo-50 w-fit px-2 py-0.5 rounded">{k.alasan}</p>
                          {k.keterangan && <p className="text-xs text-slate-600 italic">"{k.keterangan}"</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}