import Link from 'next/link'
import Image from 'next/image'
import { getCurrentUser } from '@/utils/auth/server'
import { MENU_ITEMS } from '@/config/menu'
import {
  ArrowRight,
  BellRing,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  MessageSquareText,
  PieChart,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react'

export const metadata = {
  title: 'MANSATAS App',
  description: 'Ruang kerja digital MAN 1 Tasikmalaya untuk layanan madrasah yang lebih tertib, cepat, dan terukur.',
}

export const dynamic = 'force-dynamic'

const operatingSignals = [
  { label: 'Kehadiran hari ini', value: '94%', tone: 'bg-emerald-500', icon: ScanLine },
  { label: 'Agenda aktif', value: '18', tone: 'bg-sky-500', icon: CalendarCheck2 },
  { label: 'Surat diproses', value: '27', tone: 'bg-amber-500', icon: FileText },
]

const workstreams = [
  {
    title: 'Akademik dan kelas',
    description: 'Data siswa, kelas, jadwal, nilai harian, dan rekap absensi tersusun dalam alur kerja yang mudah dipantau.',
    icon: GraduationCap,
  },
  {
    title: 'Kesiswaan dan BK',
    description: 'Izin, kedisiplinan, catatan tindak lanjut, dan layanan bimbingan berada di satu ruang koordinasi.',
    icon: UsersRound,
  },
  {
    title: 'Administrasi madrasah',
    description: 'Surat, rapat, buku tamu, agenda, penugasan, dan monitoring kegiatan lebih cepat ditelusuri.',
    icon: ClipboardList,
  },
  {
    title: 'Keuangan dan layanan',
    description: 'SPP, DSPT, daftar ulang, koperasi, dan laporan kas hadir dengan alur yang jelas untuk petugas.',
    icon: PieChart,
  },
]

const timeline = [
  { time: '07.00', title: 'Presensi dimulai', detail: 'Kelas X-1 sampai XII-7 dipantau otomatis.' },
  { time: '09.30', title: 'Surat masuk diverifikasi', detail: '3 dokumen menunggu disposisi pimpinan.' },
  { time: '12.15', title: 'Agenda piket diperbarui', detail: 'Catatan kejadian siang sudah tercatat.' },
]

const trustPoints = [
  'Akses berbasis peran untuk guru dan tenaga kependidikan',
  'Data operasional tersambung lintas unit kerja',
  'Siap dipakai di desktop maupun perangkat mobile',
]

const featureGroups = [
  {
    title: 'Utama & data master',
    summary: 'Fondasi data madrasah: pengguna, siswa, kelas, dan plotting.',
    ids: ['dashboard', 'siswa', 'kelas', 'plotting', 'guru'],
  },
  {
    title: 'Akademik & pembelajaran',
    summary: 'Jadwal, agenda, absensi, nilai, rekap akademik, dan tahfidz.',
    ids: ['akademik', 'akademik-nilai', 'kehadiran', 'rekap-absensi', 'keterangan-absensi', 'agenda', 'nilai-harian', 'tahfidz'],
  },
  {
    title: 'Koordinasi & monitoring',
    summary: 'Penugasan, rapat, monitoring agenda, dan pemantauan pekerjaan.',
    ids: ['penugasan', 'monitoring-agenda', 'monitoring-penugasan', 'rapat', 'jadwal-piket', 'analitik'],
  },
  {
    title: 'Kesiswaan & layanan BK',
    summary: 'Perizinan, kedisiplinan, BK, psikotes, TKA, dan penerimaan PT.',
    ids: ['izin', 'kedisiplinan', 'bk', 'psikotes', 'tka', 'penerimaan-pt'],
  },
  {
    title: 'Administrasi madrasah',
    summary: 'Surat, sarpras, PPL, dan buku tamu.',
    ids: ['surat', 'sarpras', 'kelola-ppl', 'buku-tamu'],
  },
  {
    title: 'Keuangan',
    summary: 'DSPT, SPP, daftar ulang, koperasi, kas keluar, dan laporan.',
    ids: ['keuangan-dashboard', 'keuangan-daftar-ulang', 'keuangan-dspt', 'keuangan-spp', 'keuangan-koperasi', 'keuangan-kas-keluar', 'keuangan-laporan'],
  },
  {
    title: 'Sistem & notifikasi',
    summary: 'Pengaturan aplikasi, akses fitur, broadcast, dan jadwal notifikasi.',
    ids: ['settings', 'settings-fitur', 'settings-notifications', 'settings-jadwal-notif'],
  },
].map((group) => ({
  ...group,
  features: group.ids
    .map((id) => MENU_ITEMS.find((item) => item.id === id))
    .filter((item): item is (typeof MENU_ITEMS)[number] => Boolean(item)),
}))

const featureDescriptions: Record<string, string> = {
  dashboard: 'Halaman awal untuk melihat ringkasan pekerjaan, jadwal, pintasan menu, dan informasi penting sesuai peran pengguna.',
  siswa: 'Tempat menyimpan data siswa secara lengkap, mulai dari biodata, foto, buku induk, tahun masuk, sampai status siswa aktif atau keluar.',
  kelas: 'Membantu mengatur rombel, wali kelas, anggota kelas, perpindahan siswa, kelas binaan BK, sampai blanko absensi yang siap dicetak.',
  plotting: 'Ruang kerja untuk menyusun siswa baru, penjurusan, pembagian kelas, plotting massal, dan proses kelulusan dengan lebih tertib.',
  akademik: 'Pusat pengaturan mapel, guru mengajar, jadwal kelas, jadwal guru, import jadwal ASC, dan pembagian guru piket bergilir.',
  'akademik-nilai': 'Dipakai untuk memasukkan dan mengecek nilai akademik dari Excel, lalu melihat rekap nilai siswa dengan lebih rapi.',
  tahfidz: 'Mencatat perkembangan hafalan siswa, setoran ayat, nilai per juz, riwayat setoran, laporan, dan analitik program tahfidz.',
  guru: 'Mengelola akun guru dan pegawai, termasuk data profil, role akses, reset password, import data, dan foto pegawai.',
  kehadiran: 'Guru dapat mengisi absensi siswa sesuai jadwal mengajar hari itu, lengkap dengan catatan hadir, sakit, izin, alfa, atau parsial.',
  'rekap-absensi': 'Menyajikan rekap kehadiran siswa agar wali kelas, TU, wakamad, dan pimpinan bisa melihat kondisi absensi dengan cepat.',
  'keterangan-absensi': 'Wali kelas bisa memberi keterangan ketidakhadiran siswa per tanggal, baik satu per satu maupun sekaligus satu kelas.',
  agenda: 'Guru mencatat agenda mengajar dan materi pembelajaran, sementara guru piket dapat mengisi agenda piket harian.',
  'nilai-harian': 'Guru bisa membuat sesi penilaian, mengisi nilai siswa, mengatur KKM, dan melihat rata-rata nilai harian per kelas.',
  penugasan: 'Memudahkan guru atau pegawai mendelegasikan tugas, menerima tugas masuk, dan melihat pekerjaan yang sudah dikirim.',
  'monitoring-agenda': 'Pimpinan dan admin dapat memantau agenda guru, rekap kehadiran mengajar, agenda piket, serta mencetak laporan.',
  'monitoring-penugasan': 'Menampilkan pekerjaan yang sedang didelegasikan, siapa pengirimnya, siapa penerimanya, dan bagaimana statusnya.',
  rapat: 'Membuat undangan rapat, memilih peserta, menerima konfirmasi kehadiran, mengirim ulang undangan, dan memberi pengingat.',
  'jadwal-piket': 'Mengatur siapa saja guru piket setiap hari dan shift, sehingga pencatatan piket harian punya dasar yang jelas.',
  izin: 'Mencatat izin siswa, baik tidak masuk, keluar, maupun izin di jam pelajaran, lengkap dengan alasan dan status kembali.',
  kedisiplinan: 'Mencatat pelanggaran siswa, poin beban, jenis sanksi, tindak lanjut, dan ringkasan kasus kedisiplinan.',
  sarpras: 'Mendata aset madrasah, kategori barang, kondisi aset, foto aset, dan filter pencarian sarana prasarana.',
  bk: 'Guru BK dapat mengelola kelas binaan, topik bimbingan, rekaman masalah siswa, sesi konseling, home visit, dan tindak lanjut.',
  psikotes: 'Mengelola hasil psikotes siswa seperti IQ, gaya belajar, bakat-minat, RIASEC, MBTI, dan rekomendasi jurusan.',
  analitik: 'Membantu membaca data nilai untuk kebutuhan ranking, kelulusan, SNBP, SPAN, ijazah, dan ekspor hasil analisis.',
  tka: 'Mengatur pilihan mapel TKA, mengimpor hasil tes, mencocokkan nama siswa, melihat daftar hasil, dan membaca analitik nilai.',
  'penerimaan-pt': 'Mencatat siswa kelas 12 yang diterima di perguruan tinggi berdasarkan jalur, kampus, status, dan hasil import data.',
  surat: 'Membuat dan menyimpan arsip surat keluar, seperti SPPD, surat tugas, keterangan aktif, pindah, undangan, dan surat lainnya.',
  'kelola-ppl': 'Menghubungkan guru PPL dengan guru utama, jadwal mengajar, dan jadwal piket agar akses tugas PPL sesuai penugasan.',
  'buku-tamu': 'Mencatat kunjungan tamu individu atau instansi, termasuk foto, tujuan kunjungan, daftar tamu hari ini, dan monitoring kunjungan.',
  'keuangan-dashboard': 'Menampilkan gambaran keuangan madrasah, mulai dari tagihan, pembayaran, pemasukan, pengeluaran, sampai rekap angkatan.',
  'keuangan-daftar-ulang': 'Kasir untuk proses daftar ulang, pembayaran DSPT dan koperasi, pemberian diskon, transaksi, dan cetak kuitansi.',
  'keuangan-dspt': 'Mengatur target DSPT, pembayaran, diskon, status pelunasan, import data, dan nominal massal per angkatan.',
  'keuangan-spp': 'Mengelola nominal SPP, awal tagihan tiap siswa atau angkatan, tagihan bulanan, saldo awal, pembayaran, dan import data.',
  'keuangan-koperasi': 'Mengatur item koperasi, membuat tagihan, mencatat pembayaran, memberi diskon, dan melihat sisa tagihan.',
  'keuangan-kas-keluar': 'Mencatat pengeluaran kas madrasah berdasarkan kategori seperti operasional, pemeliharaan, kegiatan siswa, dan administrasi.',
  'keuangan-laporan': 'Menyediakan laporan keuangan dari transaksi, tagihan, pembayaran, kas keluar, dan rekap dalam periode tertentu.',
  settings: 'Tempat mengatur tahun ajaran, jurusan, pola jam pelajaran, tahun aktif, dan konfigurasi dasar aplikasi.',
  'settings-fitur': 'Mengatur fitur apa saja yang boleh diakses tiap role, membuat role khusus, override akses user, dan bottom nav mobile.',
  'settings-notifications': 'Mengirim pengumuman atau broadcast ke pengguna tertentu melalui notifikasi aplikasi.',
  'settings-jadwal-notif': 'Menjadwalkan notifikasi rutin, mengaktifkan atau mematikan jadwal, menghapus jadwal, dan mencoba kirim notifikasi.',
}

const advantages = [
  'Terpadu dalam satu aplikasi, dari kelas sampai keuangan.',
  'Hak akses mengikuti peran pengguna, jadi tampilan lebih relevan.',
  'Mendukung pekerjaan harian guru, TU, BK, piket, bendahara, dan pimpinan.',
  'Data lebih mudah dipantau karena status pekerjaan tersaji di dashboard.',
  'Siap untuk mobile sehingga akses cepat dari perangkat harian.',
  'Dilengkapi broadcast dan notifikasi terjadwal untuk informasi penting.',
]

export default async function LandingPage() {
  const user = await getCurrentUser()
  const primaryHref = user ? '/dashboard' : '/login'
  const primaryLabel = user ? 'Buka Dashboard' : 'Masuk ke MANSATAS'
  const PrimaryIcon = user ? LayoutDashboard : LogIn

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#f5f8f2] text-[#111827] selection:bg-emerald-200 selection:text-emerald-950">
      <div className="relative min-h-[100dvh] overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.46]"
          style={{
            backgroundImage:
              'linear-gradient(#dce8d6 1px, transparent 1px), linear-gradient(90deg, #dce8d6 1px, transparent 1px)',
            backgroundSize: '42px 42px',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-80 bg-[linear-gradient(180deg,#e8f4e8_0%,rgba(232,244,232,0)_100%)]" />
        <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-emerald-200/45 blur-3xl" />
        <div className="absolute -left-44 bottom-24 h-96 w-96 rounded-full bg-amber-200/45 blur-3xl" />

        <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="MANSATAS App">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-900/10 bg-white shadow-sm">
              <Image
                src="/logokemenag.png"
                alt="Logo Kementerian Agama"
                width={34}
                height={34}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black uppercase tracking-[0.18em] text-emerald-900">MANSATAS</span>
              <span className="block text-xs font-semibold text-slate-500">MAN 1 Tasikmalaya</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#alur" className="hover:text-emerald-800">Alur kerja</a>
            <a href="#layanan" className="hover:text-emerald-800">Layanan</a>
            <a href="#keamanan" className="hover:text-emerald-800">Keamanan</a>
          </nav>

          <Link
            href={primaryHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:bg-emerald-950 sm:px-5"
          >
            <PrimaryIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{primaryLabel}</span>
            <span className="sm:hidden">Masuk</span>
          </Link>
        </header>

        <main className="relative z-10">
          <section className="mx-auto grid min-h-[calc(100dvh_-_84px)] w-full max-w-7xl items-center gap-9 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:px-10">
            <div className="max-w-2xl text-center sm:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/85 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-900 shadow-sm">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Ruang kerja madrasah
              </div>

              <h1 className="mx-auto max-w-xl text-5xl font-black leading-[0.98] tracking-normal text-slate-950 sm:mx-0 sm:text-6xl lg:text-7xl">
                MANSATAS App
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-base font-semibold leading-7 text-slate-600 sm:mx-0 sm:text-lg sm:leading-8">
                Satu pusat kendali untuk menyatukan layanan akademik, kesiswaan, administrasi, keuangan, dan agenda harian MAN 1 Tasikmalaya.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={primaryHref}
                  className="group inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-emerald-700 px-6 text-sm font-black text-white shadow-[0_18px_40px_rgba(4,120,87,0.24)] transition hover:-translate-y-0.5 hover:bg-emerald-800"
                >
                  <span>{primaryLabel}</span>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <a
                  href="#layanan"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/85 px-6 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:text-emerald-900"
                >
                  Lihat layanan
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>

              <div className="mx-auto mt-8 grid max-w-xl gap-3 text-left sm:mx-0">
                {trustPoints.map((point) => (
                  <div key={point} className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto min-h-[430px] w-full max-w-[680px] sm:min-h-[520px] lg:min-h-[650px] lg:max-w-none">
              <div className="absolute inset-0 rounded-[1.7rem] border border-slate-900/10 bg-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.26)] sm:rounded-[2rem]" />
              <div className="absolute inset-2 overflow-hidden rounded-[1.35rem] bg-[#f9fbf6] sm:inset-3 sm:rounded-[1.55rem]">
                <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:h-16 sm:px-5">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-rose-400" />
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  </div>
                  <div className="hidden rounded-md bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 sm:block">
                    mansatas.app/dashboard
                  </div>
                  <BellRing className="h-5 w-5 text-slate-500" />
                </div>

                <div className="grid min-h-[calc(100%_-_3.5rem)] grid-cols-1 lg:min-h-[calc(100%_-_4rem)] lg:grid-cols-[220px_1fr]">
                  <aside className="hidden border-r border-slate-200 bg-slate-50 p-5 lg:block">
                    <div className="mb-7 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900">Operator</p>
                        <p className="text-xs font-semibold text-slate-500">Piket pagi</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {['Ringkasan', 'Kehadiran', 'Agenda', 'Surat', 'Keuangan'].map((item, index) => (
                        <div
                          key={item}
                          className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm font-bold ${
                            index === 0 ? 'bg-emerald-700 text-white' : 'text-slate-600'
                          }`}
                        >
                          <span>{item}</span>
                          {index === 0 ? <ChevronRight className="h-4 w-4" /> : null}
                        </div>
                      ))}
                    </div>
                  </aside>

                  <div className="p-4 sm:p-6">
                    <div className="mb-4 flex flex-col justify-between gap-3 sm:mb-5 sm:flex-row sm:items-end">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Hari ini</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">Pusat Kendali Layanan</h2>
                      </div>
                      <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Sinkron aktif
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {operatingSignals.map((signal) => {
                        const SignalIcon = signal.icon
                        return (
                          <div key={signal.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-lg ${signal.tone} text-white`}>
                              <SignalIcon className="h-4 w-4" />
                            </div>
                            <p className="text-2xl font-black text-slate-950 sm:text-3xl">{signal.value}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{signal.label}</p>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-sm font-black text-slate-950">Arus pekerjaan</h3>
                          <Clock3 className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="space-y-4">
                          {timeline.map((item) => (
                            <div key={item.time} className="grid grid-cols-[56px_1fr] gap-3">
                              <span className="rounded-lg bg-slate-100 px-2 py-1 text-center text-xs font-black text-slate-600">
                                {item.time}
                              </span>
                              <div>
                                <p className="text-sm font-black text-slate-900">{item.title}</p>
                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="hidden rounded-xl border border-slate-200 bg-[#111827] p-4 text-white shadow-sm sm:block">
                        <div className="mb-4 flex items-center gap-2">
                          <MessageSquareText className="h-4 w-4 text-amber-300" />
                          <h3 className="text-sm font-black">Catatan cepat</h3>
                        </div>
                        <p className="text-sm font-semibold leading-6 text-slate-200">
                          Semua unit bisa melihat pekerjaan yang perlu ditindaklanjuti tanpa menunggu pesan berulang.
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-white/10 p-3">
                            <p className="text-2xl font-black">8</p>
                            <p className="text-xs font-bold text-slate-300">Tugas baru</p>
                          </div>
                          <div className="rounded-lg bg-white/10 p-3">
                            <p className="text-2xl font-black">5</p>
                            <p className="text-xs font-bold text-slate-300">Perlu cek</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="alur" className="border-y border-slate-200 bg-white">
            <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Cara kerja</p>
                <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">Dari data harian menjadi keputusan yang rapi.</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {['Catat', 'Koordinasi', 'Tindak lanjuti'].map((step, index) => (
                  <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <span className="text-xs font-black text-emerald-800">0{index + 1}</span>
                    <h3 className="mt-5 text-lg font-black text-slate-950">{step}</h3>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                      {index === 0
                        ? 'Setiap layanan masuk melalui form dan modul yang sesuai.'
                        : index === 1
                          ? 'Unit terkait melihat konteks yang sama tanpa dokumen tercecer.'
                          : 'Status pekerjaan mudah dipantau sampai selesai.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="layanan" className="bg-[#f5f8f2]">
            <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
              <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Layanan utama</p>
                  <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">Satu aplikasi untuk banyak meja kerja.</h2>
                </div>
                <p className="max-w-md text-sm font-semibold leading-6 text-slate-600">
                  Dirancang untuk pekerjaan madrasah yang berulang, detail, dan butuh kejelasan status.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {workstreams.map((item) => {
                  const WorkIcon = item.icon
                  return (
                    <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                        <WorkIcon className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-black text-slate-950">{item.title}</h3>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                    </article>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="border-y border-slate-200 bg-white">
            <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
              <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Fitur aplikasi</p>
                  <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
                    Semua modul MANSATAS App.
                  </h2>
                </div>
                <p className="max-w-md text-sm font-semibold leading-6 text-slate-600">
                  Total {MENU_ITEMS.length} fitur aktif yang disusun untuk kebutuhan operasional MAN 1 Tasikmalaya.
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {featureGroups.map((group) => (
                  <details
                    key={group.title}
                    className="group rounded-xl border border-slate-200 bg-[#f9fbf6] p-5 shadow-sm open:bg-white"
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                      <span>
                        <span className="block text-base font-black text-slate-950">{group.title}</span>
                        <span className="mt-2 block text-sm font-semibold leading-6 text-slate-600">{group.summary}</span>
                        <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                          {group.features.length} fitur
                        </span>
                      </span>
                      <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm transition group-open:rotate-90">
                        <ChevronRight className="h-5 w-5" />
                      </span>
                    </summary>

                    <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5">
                      {group.features.map((feature) => {
                        const FeatureIcon = feature.icon
                        return (
                          <div key={feature.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm">
                              <FeatureIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-950">{feature.title}</h4>
                              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                                {featureDescriptions[feature.id] ?? 'Modul kerja MANSATAS App untuk mendukung operasional madrasah.'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                ))}
              </div>

              <div className="mt-10 rounded-2xl bg-slate-950 p-5 text-white shadow-[0_24px_70px_rgba(15,23,42,0.2)] sm:p-7">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Kelebihan</p>
                    <h3 className="mt-2 text-2xl font-black sm:text-3xl">Keunggulan untuk kerja madrasah.</h3>
                  </div>
                  <ShieldCheck className="hidden h-10 w-10 text-emerald-300 sm:block" />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {advantages.map((advantage) => (
                    <div key={advantage} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                      <p className="text-sm font-semibold leading-6 text-slate-200">{advantage}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="keamanan" className="bg-slate-950 text-white">
            <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-10">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Akses tertib</p>
                <h2 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">Setiap pengguna masuk ke ruang kerja yang sesuai perannya.</h2>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                  <BookOpenCheck className="h-5 w-5 text-amber-300" />
                  <p className="text-sm font-black">Portal resmi MAN 1 Tasikmalaya</p>
                </div>
                <p className="mt-4 text-sm font-semibold leading-7 text-slate-300">
                  MANSATAS App menjaga akses modul berdasarkan tugas pengguna, sehingga guru, wali kelas, bendahara, BK, piket, resepsionis, dan pimpinan dapat bekerja dari data yang relevan.
                </p>
                <Link
                  href={primaryHref}
                  className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-100"
                >
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
