// config/app-blueprint.ts
// SOURCE OF TRUTH: Denah Arsitektur, Pemetaan Modul, Peran, dan Alur Kerja Aplikasi MANSATAS.
// ATURAN UNTUK AGENT AI: Setiap kali menambah, mengubah, atau menghapus fitur/role di aplikasi,
// WAJIB memperbarui data di file ini agar Denah Aplikasi (/dashboard/dokumentasi) selalu akurat.

export type ModuleItem = {
  id: string
  title: string
  href: string
  domain: 'kbm' | 'kesiswaan' | 'keuangan' | 'operasional' | 'kepegawaian' | 'portal'
  summary: string
  description: string
  roles: string[]
  keyFeatures: string[]
  inputs: string[]
  outputs: string[]
}

export type DomainGroup = {
  id: ModuleItem['domain']
  title: string
  badge: string
  color: string
  description: string
}

export const APP_DOMAINS: DomainGroup[] = [
  {
    id: 'kbm',
    title: 'Akademik & Pembelajaran (KBM)',
    badge: 'KBM',
    color: 'emerald',
    description: 'Siklus pengajaran madrasah mulai dari plotting penugasan, jadwal mingguan, agenda harian guru, presensi jam ke jam, hingga rekap nilai.',
  },
  {
    id: 'kesiswaan',
    title: 'Kesiswaan & Pembinaan Karakter',
    badge: 'Kesiswaan',
    color: 'blue',
    description: 'Data induk santri/siswa, perwalian kelas binaan, bimbingan konseling (BK), penegakan tata tertib & poin pelanggaran, serta ekstrakurikuler.',
  },
  {
    id: 'keuangan',
    title: 'Sistem Keuangan & Kas Komite',
    badge: 'Keuangan',
    color: 'amber',
    description: 'Pencatatan tagihan dan pembayaran DSPT (Uang Pangkal), iuran SPP, kas keluar operasional, buku kas komite, verifikasi transfer, dan kuitansi resmi.',
  },
  {
    id: 'operasional',
    title: 'Operasional Harian & Pelayanan',
    badge: 'Operasional',
    color: 'purple',
    description: 'Layanan publik resepsionis (buku tamu), satpam (izin keluar gerbang), pemantauan kebersihan pramubakti, surat dinas, dan undangan rapat.',
  },
  {
    id: 'kepegawaian',
    title: 'Kepegawaian & Tata Usaha',
    badge: 'Kepegawaian',
    color: 'indigo',
    description: 'Penyusunan Catatan Kinerja Harian (CKH) pegawai/guru, tanda tangan digital kepala madrasah, pemberkasan TPG S36, dan kelola akun pengguna.',
  },
  {
    id: 'portal',
    title: 'Portal Eksternal (Orang Tua)',
    badge: 'Portal Ortu',
    color: 'rose',
    description: 'Akses transparansi mandiri orang tua untuk memantau presensi anak secara realtime, jadwal kelas, nilai akademik, tagihan biaya, dan kotak saran.',
  },
]

export const APP_MODULES: ModuleItem[] = [
  // --- KBM ---
  {
    id: 'kalender-pendidikan',
    title: 'Kalender Pendidikan',
    href: '/dashboard/kalender-pendidikan',
    domain: 'kbm',
    summary: 'Mengatur hari efektif, libur, kegiatan, dan pengecualian jam KBM.',
    description: 'Kalender menjadi acuan hari efektif pembelajaran. Pengecualian KBM berlaku pada tanggal dan rentang jam tertentu untuk semua kelas, satu tingkat, atau beberapa kelas yang dipilih melalui checkbox dalam dropdown. Pilihan kelas tersimpan dalam satu pengecualian dan dapat diedit bersama.',
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    keyFeatures: ['Kalender bulanan dan hari efektif', 'Sinkron tanggal merah dan impor kalender resmi', 'Pengecualian jam KBM dengan pilihan beberapa kelas', 'Edit dan hapus pengecualian KBM'],
    inputs: ['Tanggal dan kategori kegiatan', 'Rentang jam pelajaran', 'Sasaran semua kelas, tingkat, atau pilihan beberapa kelas'],
    outputs: ['Status hari efektif', 'Pengecualian jam untuk agenda, absensi, dan rekap pembelajaran'],
  },
  {
    id: 'agenda',
    title: 'Agenda Guru',
    href: '/dashboard/agenda',
    domain: 'kbm',
    summary: 'Pengisian jurnal mengajar harian, materi pelajaran, dan absensi kehadiran siswa di kelas.',
    description: 'Digunakan oleh guru mata pelajaran setiap jam mengajar untuk mencatat materi yang diajarkan, melampirkan foto dokumentasi kelas, dan otomatis menandai siswa hadir/absen.',
    roles: ['guru', 'guru_ppl', 'guru_tahfidz', 'super_admin', 'admin_tu'],
    keyFeatures: ['Jurnal KBM harian', 'Upload foto kelas ber-timestamp dengan kompresi WebP/JPEG sesuai dukungan perangkat', 'Kamera bawaan dengan fallback preview kamera browser langsung di halaman jika pengambilan/pembacaan foto gagal; kamera halaman juga dapat dipilih manual', 'Pemulihan foto kamera Android melalui file perangkat; lokasi foto disimpan sebelum kompresi', 'Draft materi/foto dan kirim ulang jika koneksi gagal; tombol ambil foto lagi jika hasil kamera belum tersedia; sukses setelah penyimpanan dikonfirmasi server', 'Presensi per jam pelajaran', 'Audit akses agenda'],
    inputs: ['Materi pembelajaran', 'Status presensi siswa (Hadir/Sakit/Izin/Alfa)', 'Foto bukti mengajar'],
    outputs: ['Data rekap kehadiran siswa realtime', 'Arsip jurnal kelas', 'Status mengajar hari ini'],
  },
  {
    id: 'rekap-absensi',
    title: 'Rekap Absensi Siswa',
    href: '/dashboard/rekap-absensi',
    domain: 'kbm',
    summary: 'Ringkasan kehadiran per kelas, per siswa, dan per jam pelajaran.',
    description: 'Kehadiran Saat Ini memakai satu jam acuan terakhir yang sudah diinput guru sampai jam berjalan per kelas untuk pembagian MBG. Jam yang belum diinput menggunakan jam sebelumnya; tanpa input ditandai belum diabsen. Data sementara terpisah dari rekap harian setelah KBM.',
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'wali_kelas', 'pramubakti'],
    keyFeatures: ['Kehadiran Saat Ini dengan jam acuan per kelas', 'Pramubakti dapat membaca jumlah per kelas; akses detail tetap mengikuti cakupan kelas existing', 'Rekap harian setelah KBM', 'Ringkasan rentang tanggal', 'Rincian per siswa dan per jam', 'Menu kartu cetak shadcn dengan ikon dan keterangan: bulanan, semester, per kelas, per siswa, daftar tidak hadir, dan catatan absen guru; navigasi SPA ke konfigurasi khusus dokumen dan tombol kembali ke menu, cetak langsung, pratinjau opsional, serta ekspor Excel tanpa wajib memuat pratinjau', 'Cetak per siswa menggunakan template bersama Profil Siswa dengan kop, NIS lokal, filter hari, dan tanda tangan wali kelas'],
    inputs: ['Absensi guru dan perizinan siswa', 'Tanggal dan angkatan'],
    outputs: ['Jumlah hadir sementara untuk MBG', 'Laporan kehadiran harian'],
  },
  {
    id: 'jadwal',
    title: 'Jadwal Mengajar',
    href: '/dashboard/jadwal',
    domain: 'kbm',
    summary: 'Matriks jadwal pelajaran mingguan per kelas dan per guru mata pelajaran.',
    description: 'Menampilkan jadwal pelajaran aktif berdasarkan tahun ajaran dan semester. Menjadi acuan pembentukan sesi agenda guru dan presensi otomatis.',
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_piket', 'wali_kelas'],
    keyFeatures: ['Jadwal per hari dan jam pelajaran', 'Filter per kelas & guru', 'Deteksi jadwal bentrok'],
    inputs: ['Penugasan guru', 'Slot jam pelajaran', 'Struktur rombel'],
    outputs: ['Matriks jadwal mengajar', 'Jadwal harian di portal ortu'],
  },
  {
    id: 'penugasan',
    title: 'Penugasan Mengajar',
    href: '/dashboard/penugasan',
    domain: 'kbm',
    summary: 'Pemetaan guru mata pelajaran ke rombongan belajar (rombel) pada tahun ajaran aktif.',
    description: 'Pondasi utama sistem KBM. Setiap jadwal, agenda, dan absensi bertumpu pada ID penugasan mengajar ini.',
    roles: ['super_admin', 'admin_tu', 'wakamad'],
    keyFeatures: ['Plotting guru-mapel-kelas', 'Dukungan guru PPL & guru pengganti', 'Integrasi SK pembagian tugas'],
    inputs: ['Guru', 'Mata Pelajaran', 'Kelas/Rombel', 'Tahun Ajaran'],
    outputs: ['Daftar penugasan aktif', 'Hak akses guru mengisi agenda'],
  },
  {
    id: 'kehadiran',
    title: 'Rekap Presensi Siswa',
    href: '/dashboard/kehadiran',
    domain: 'kbm',
    summary: 'Rekap kehadiran siswa dari hasil input agenda guru dan validasi wali kelas.',
    description: 'Memantau tingkat kehadiran siswa di setiap mata pelajaran secara harian, mingguan, dan bulanan. Koreksi status disimpan lebih dahulu di perangkat per pengguna dan konteks rekap, lalu dikirim secara batch setelah 2 detik tanpa perubahan baru. Draft belum terkirim dipulihkan setelah refresh dan dicoba saat jaringan kembali; kegagalan ditampilkan dan dapat dicoba kembali.',
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'wali_kelas', 'guru_piket'],
    keyFeatures: ['Monitoring presensi jam ke jam', 'Ekspor rekap Excel/XLSX', 'Rekap persentase kehadiran per siswa', 'Rekap Sesi Saya dengan filter tahun ajaran terpisah dari mapel/kelas, default tahun ajaran aktif'],
    inputs: ['Filter tanggal', 'Kelas', 'Tahun ajaran'],
    outputs: ['Rekap persentase hadir/sakit/izin/alfa', 'Laporan kehadiran bulanan'],
  },
  {
    id: 'rppm-generator',
    title: 'RPPM Generator',
    href: '/dashboard/rppm-generator',
    domain: 'kbm',
    summary: 'Penyusunan Rencana Pelaksanaan Pembelajaran Mingguan berbantuan kecerdasan buatan.',
    description: 'Membantu guru menyusun rancangan pembelajaran mingguan sesuai kurikulum yang berlaku secara otomatis dan terstruktur.',
    roles: ['guru', 'wali_kelas', 'guru_ppl', 'super_admin', 'admin_tu'],
    keyFeatures: ['Generator tema & subtema', 'Penyusunan target capaian', 'Ekspor dokumen pembelajaran'],
    inputs: ['Mata pelajaran', 'Fase/Tingkat', 'Topik materi'],
    outputs: ['Dokumen RPPM siap cetak'],
  },
  {
    id: 'monitoring-agenda',
    title: 'Monitoring Agenda & Piket',
    href: '/dashboard/monitoring-agenda',
    domain: 'kbm',
    summary: 'Pemantauan realtime keterlaksanaan jam mengajar guru oleh guru piket dan pimpinan.',
    description: 'Memastikan seluruh jam pelajaran terisi oleh guru yang bertugas atau ditangani oleh guru delegasi/piket jika guru utama berhalangan.',
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_piket'],
    keyFeatures: ['Status kelas kosong vs terisi', 'Pendelegasian tugas guru berhalangan', 'Cetak rekap piket harian'],
    inputs: ['Laporan keterlambatan/kekosongan kelas', 'Penugasan guru piket pengganti'],
    outputs: ['Laporan jurnal piket harian', 'Notifikasi ke pimpinan'],
  },

  // --- KESISWAAN ---
  {
    id: 'siswa',
    title: 'Data Induk Siswa',
    href: '/dashboard/siswa',
    domain: 'kesiswaan',
    summary: 'Pangkalan data lengkap seluruh siswa aktif, pindahan, mutasi, dan alumni.',
    description: 'Menyimpan identitas lengkap siswa, NISN, data orang tua, domisili, kontak WhatsApp wali, serta histori kelas dan prestasi.',
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru', 'guru_bk', 'guru_piket', 'wali_kelas', 'resepsionis', 'operator'],
    keyFeatures: [
      'Pencarian cepat nama/NISN',
      'Profil komprehensif siswa & buku induk digital dengan navigasi tab responsif',
      'Menu aksi terpadu responsif (Edit biodata, Cetak Full Report, Insight Verifikasi, Mutasi, Tandai Keluar)',
      'Kehadiran Full Report menghitung status akhir per hari setelah KBM dengan koreksi wali dan perizinan; seluruh riwayat mengikuti kelas dan jadwal tiap semester, arsip bulanan ditampilkan terpisah',
      'Cetak Full Report dioptimalkan hitam putih: teks dan garis tabel hitam, latar putih, gambar grayscale, serta margin A4 konsisten di setiap halaman',
      'Sinkronisasi lengkap biodata pribadi, domisili/asrama, dan data orang tua/wali',
      'Histori mutasi & kelas',
      'Import/Export data siswa',
    ],
    inputs: ['Biodata siswa', 'Data orang tua/wali', 'Status aktif/keluar/lulus'],
    outputs: ['Buku induk siswa', 'Kartu pelajar', 'Profil terpadu santri'],
  },
  {
    id: 'kelas-binaan',
    title: 'Kelas Binaan (Wali Kelas)',
    href: '/dashboard/kelas-binaan',
    domain: 'kesiswaan',
    summary: 'Pusat komando wali kelas untuk memantau kehadiran harian, rekapitulasi absensi per blok/mapel, kedisiplinan, dan notifikasi ortu.',
    description: 'Dirancang khusus bagi wali kelas untuk memonitor presensi harian dengan avatar siswa, rekap absensi mobile-first in-place (harian per blok mata pelajaran, bulanan, rentang tanggal), pembinaan siswa berisiko, dan notifikasi panggilan orang tua.',
    roles: ['wali_kelas', 'super_admin', 'admin_tu'],
    keyFeatures: ['Status harian otomatis setelah KBM: Alfa → Sakit → Izin → Hadir; koreksi wali tersimpan terpisah', 'Draft koreksi lokal per akun/kelas/tanggal, pemulihan setelah refresh, dan simpan batch otomatis setelah 2 detik tanpa perubahan baru', 'Tautan notifikasi ke /dashboard/kelas-binaan/koreksi untuk koreksi cepat satu siswa dengan pemeriksaan konflik', 'Rekap absensi in-place per blok mata pelajaran & bulanan', 'Status panggilan orang tua', 'Notifikasi wali via FCM dengan jeda bawaan 0 menit; orang tua 5 menit, dapat diatur di Notifikasi Otomatis', 'Catatan pembinaan siswa'],
    inputs: ['Koreksi status absensi siswa', 'Catatan koreksi wali kelas', 'Catatan pembinaan berkala', 'Surat panggilan ortu'],
    outputs: ['Rekap absensi harian per blok & bulanan', 'Notifikasi otomatis ke portal ortu', 'Kotak masuk pribadi wali di /dashboard/kelas-binaan/notifikasi, diakses lewat tombol di sebelah Riwayat & Koreksi: khusus kehadiran, pelanggaran, sanksi, surat peringatan, dan klarifikasi siswa; daftar dan jumlah belum dibaca tidak mencakup agenda guru atau modul lain', 'Laporan pembinaan wali kelas'],
  },
  {
    id: 'bk',
    title: 'Bimbingan Konseling (BK)',
    href: '/dashboard/bk',
    domain: 'kesiswaan',
    summary: 'Pencatatan konseling, pemantauan psikososial, dan penanganan masalah siswa.',
    description: 'Modul rahasia guru BK untuk mencatat sesi konseling individu/kelompok, home visit, serta rekomendasi tindak lanjut bagi siswa yang membutuhkan perhatian khusus.',
    roles: ['guru_bk', 'super_admin', 'kepsek', 'wakamad'],
    keyFeatures: ['Catatan konseling privat', 'Histori pemanggilan siswa', 'Rekomendasi tindak lanjut', 'Arsip bimbingan karir'],
    inputs: ['Keluhan/masalah siswa', 'Hasil konseling', 'Laporan home visit'],
    outputs: ['Laporan perkembangan kepribadian siswa', 'Histori konseling'],
  },
  {
    id: 'kedisiplinan',
    title: 'Kedisiplinan & Tata Tertib',
    href: '/dashboard/kedisiplinan',
    domain: 'kesiswaan',
    summary: 'Pencatatan pelanggaran tata tertib, akumulasi poin, dan penerbitan Surat Peringatan (SP).',
    description: 'Menegakkan aturan madrasah secara transparan. Setiap pelanggaran menambah poin negatif yang otomatis memicu status SP 1, SP 2, SP 3, atau pemanggilan orang tua.',
    roles: ['super_admin', 'admin_tu', 'kepsek', 'wakamad', 'guru_bk', 'guru_piket', 'wali_kelas'],
    keyFeatures: ['Master jenis & poin pelanggaran', 'Akumulasi poin otomatis', 'Cetak Surat Peringatan (SP)', 'Pemicu surat panggilan ortu'],
    inputs: ['Input kejadian pelanggaran', 'Siswa terlibat', 'Bukti/keterangan'],
    outputs: ['Surat Peringatan resmi', 'Notifikasi level pelanggaran ke portal ortu'],
  },
  {
    id: 'ekstrakurikuler',
    title: 'Ekstrakurikuler',
    href: '/dashboard/ekstrakurikuler',
    domain: 'kesiswaan',
    summary: 'Pengelolaan kegiatan pengembangan diri, pendaftaran anggota, dan presensi mingguan.',
    description: 'Mewadahi kegiatan minat dan bakat siswa di luar jam KBM reguler. Input kegiatan hanya tersedia pukul 13.00–14.30 WIB pada hari jadwal latihan; tombol dinonaktifkan dengan penjelasan di luar jadwal dan waktu tersebut, serta divalidasi di server.',
    roles: ['pembina_ekstrakurikuler', 'super_admin', 'admin_tu', 'wakamad'],
    keyFeatures: ['Master ekstrakurikuler', 'Plotting anggota siswa', 'Presensi latihan rutin'],
    inputs: ['Nama ekskul', 'Pembina', 'Anggota siswa', 'Presensi'],
    outputs: ['Daftar hadir ekskul', 'Penilaian ekskul untuk rapor'],
  },
  {
    id: 'tahfidz',
    title: 'Tahfidz & Program Unggulan',
    href: '/dashboard/tahfidz',
    domain: 'kesiswaan',
    summary: 'Pencatatan setoran hafalan Al-Qur\'an dan capaian target juz siswa.',
    description: 'Memantau perkembangan hafalan santri/siswa, mutabaah harian, serta evaluasi ujian tahfidz berkala.',
    roles: ['guru_tahfidz', 'super_admin', 'kepsek', 'wakamad'],
    keyFeatures: ['Input setoran juz/surat/ayat', 'Histori hafalan siswa', 'Laporan mutabaah tahfidz'],
    inputs: ['Setoran hafalan', 'Nilai kelancaran & tajwid'],
    outputs: ['Sertifikat tahfidz', 'Rekap juz yang telah dihafal'],
  },

  // --- KEUANGAN ---
  {
    id: 'keuangan-dspt',
    title: 'DSPT (Dana Sumbangan Pendidikan)',
    href: '/dashboard/keuangan/dspt',
    domain: 'keuangan',
    summary: 'Manajemen uang pangkal/investasi pendidikan santri baru dan lama.',
    description: 'Mengatur target nominal DSPT, penerimaan pembayaran tunai/transfer, pemberian diskon/keringanan, dan pelacakan sisa piutang siswa.',
    roles: ['bendahara_komite', 'super_admin', 'ketua_komite', 'kepsek'],
    keyFeatures: ['Penetapan target per siswa', 'Penerimaan pembayaran bertahap', 'Keringanan/diskon', 'Cetak kuitansi resmi'],
    inputs: ['Nominal target', 'Setoran pembayaran', 'Metode bayar'],
    outputs: ['Kuitansi pembayaran resmi', 'Rekap saldo pelunasan DSPT'],
  },
  {
    id: 'keuangan-spp',
    title: 'Iuran Komite / SPP Bulanan',
    href: '/dashboard/keuangan/spp',
    domain: 'keuangan',
    summary: 'Pencatatan tagihan dan pembayaran iuran bulanan per kelas dan siswa.',
    description: 'Mengelola tagihan bulanan komite, status lunas/menunggak per semester, serta rekap penerimaan bulanan bendahara.',
    roles: ['bendahara_komite', 'super_admin', 'ketua_komite', 'kepsek'],
    keyFeatures: ['Billing bulanan otomatis', 'Rekap tunggakan per kelas', 'Kuitansi pembayaran SPP'],
    inputs: ['Bulan bayar', 'Nominal', 'Metode bayar'],
    outputs: ['Kuitansi SPP', 'Laporan kas masuk bulanan'],
  },
  {
    id: 'komite-pengajuan',
    title: 'Pengajuan Komite',
    href: '/dashboard/komite/pengajuan',
    domain: 'keuangan',
    summary: 'Pengajuan dana dengan persetujuan akhir Ketua Komite; tahap Kepala Madrasah opsional.',
    description: 'Alur default Bendahara → Ketua Komite → SPB. Super Admin dapat mengaktifkan persetujuan Kepala Madrasah pada halaman Pengajuan Komite; pengaturan dibaca saat Ketua menyetujui. Pengajuan yang sudah menunggu Kepala tetap diselesaikan oleh Kepala. Tahap persetujuan akhir disimpan agar SPB historis tidak berubah ketika konfigurasi diganti. Notifikasi FCM/Web Push dan reminder setiap 2 jam pada 07.00–17.00 WIB mengikuti reviewer tahap aktif, termasuk delegasi Ketua, sampai tahap diproses. Frekuensi, jam, kanal, dan aktivasi reminder dapat diatur pada pengaturan notifikasi. Pesan antrean diperiksa ulang sebelum dikirim; status terkirim tidak membuktikan perangkat menampilkan atau pengguna membaca notifikasi.',
    roles: ['super_admin', 'kepsek', 'wakamad', 'pembina_ekstrakurikuler', 'bendahara_komite', 'ketua_komite', 'anggota_komite'],
    keyFeatures: ['Draft dan dokumen per versi', 'Review berjenjang dan delegasi Ketua', 'Tahap Kepala Madrasah opsional (Super Admin)', 'Notifikasi dan reminder review sampai tahap diproses', 'SPB setelah persetujuan final dengan dua atau tiga pihak persetujuan', 'Kop Komite disertakan pada SPB dan tanda terima untuk seluruh periode; cetak dibatalkan jika kop gagal dimuat'],
    inputs: ['Pengajuan dan rincian pembayaran', 'Dokumen PDF', 'Keputusan dan catatan reviewer'],
    outputs: ['Riwayat review', 'Notifikasi reviewer aktif', 'Surat Perintah Bayar'],
  },
  {
    id: 'keuangan-kas-keluar',
    title: 'Kas Keluar & Pengajuan Anggaran',
    href: '/dashboard/keuangan/kas-keluar',
    domain: 'keuangan',
    summary: 'Pencatatan pengeluaran dana komite, pengajuan proposal kegiatan, dan upload bukti SPJ.',
    description: 'Menjaga akuntabilitas dan auditability pengeluaran dana madrasah dengan verifikasi multi-tahap dan arsip kuitansi belanja.',
    roles: ['bendahara_komite', 'super_admin', 'ketua_komite', 'kepsek'],
    keyFeatures: ['Pencatatan kas keluar', 'Pengajuan dana kegiatan', 'Upload bukti nota/kuitansi belanja', 'Laporan bulanan pengeluaran'],
    inputs: ['Kategori pengeluaran', 'Nominal belanja', 'Bukti nota fisik', 'Penanggung jawab'],
    outputs: ['Buku pengeluaran kas', 'Laporan SPJ kegiatan'],
  },
  {
    id: 'keuangan-arus-kas',
    title: 'Arus Kas & Buku Kas Komite',
    href: '/dashboard/keuangan/arus-kas',
    domain: 'keuangan',
    summary: 'Laporan arus kas komprehensif, rekonsiliasi saldo berjalan, dan jurnal harian.',
    description: 'Menyatukan arus kas masuk (DSPT, SPP, donasi) dan arus kas keluar (operasional, honor, sarpras) ke dalam satu buku kas yang diaudit secara realtime.',
    roles: ['bendahara_komite', 'super_admin', 'ketua_komite', 'anggota_komite', 'kepsek'],
    keyFeatures: ['Saldo kas tunai vs bank', 'Jurnal penerimaan & pengeluaran', 'Laporan bulanan komite', 'Ekspor format pembukuan'],
    inputs: ['Filter rentang tanggal', 'Kategori transaksi'],
    outputs: ['Laporan Arus Kas resmi', 'Posisi saldo akhir madrasah'],
  },

  // --- OPERASIONAL ---
  {
    id: 'resepsionis',
    title: 'Resepsionis & Buku Tamu',
    href: '/dashboard/resepsionis',
    domain: 'operasional',
    summary: 'Pencatatan tamu dinas, wali murid, dan pihak eksternal yang berkunjung ke madrasah.',
    description: 'Mencatat identitas tamu, instansi asal, orang yang dituju, dan keperluan kunjungan untuk menjaga keamanan dan dokumentasi kehumasan.',
    roles: ['resepsionis', 'super_admin', 'admin_tu', 'satpam', 'kepsek'],
    keyFeatures: ['Buku tamu digital', 'Foto/KTP tamu', 'Notifikasi ke pegawai yang dituju', 'Laporan kunjungan'],
    inputs: ['Nama tamu', 'Instansi', 'Keperluan', 'Kontak'],
    outputs: ['Arsip buku tamu harian'],
  },
  {
    id: 'satpam',
    title: 'Satpam & Keamanan Gerbang',
    href: '/dashboard/satpam',
    domain: 'operasional',
    summary: 'Pemeriksaan izin keluar komplek madrasah dan pemantauan santri di pos gerbang.',
    description: 'Terintegrasi dengan modul Izin Keluar Komplek siswa. Satpam memvalidasi apakah siswa yang keluar memiliki izin sah dari wali kelas/kesiswaan.',
    roles: ['satpam', 'super_admin', 'admin_tu'],
    keyFeatures: ['Validasi izin keluar santri', 'Pencatatan jam keluar & kembali', 'Penutupan otomatis izin harian pada akhir pola jam pelajaran (cron tiap 5 menit, maksimal 100 izin per proses); izin hari sebelumnya dipulihkan tanpa terbawa ke presensi hari ini, dengan catatan otomatis yang bukan konfirmasi kepulangan fisik', 'Laporan santri terlambat kembali'],
    inputs: ['Verifikasi izin siswa', 'Waktu kembali'],
    outputs: ['Log gerbang keamanan'],
  },
  {
    id: 'pramubakti',
    title: 'Layanan Pramubakti & Kebersihan',
    href: '/dashboard/pelaporan-pramubakti',
    domain: 'operasional',
    summary: 'Ceklis pekerjaan kebersihan harian dan monitoring fasilitas madrasah.',
    description: 'Pramubakti melaporkan tugas kebersihan area sekolah dengan bukti foto timestamp; manajemen memantau keterlaksanaan pemeliharaan sarana.',
    roles: ['pramubakti', 'super_admin', 'admin_tu', 'kepsek', 'wakamad'],
    keyFeatures: ['Checklist tugas rutin (toilet, taman, kelas)', 'Upload foto selesai tugas', 'Monitoring kebersihan realtime'],
    inputs: ['Laporan tugas harian', 'Foto hasil pekerjaan'],
    outputs: ['Laporan kinerja pramubakti bulanan', 'Evaluasi sarpras'],
  },
  {
    id: 'surat',
    title: 'Administrasi Persuratan',
    href: '/dashboard/surat',
    domain: 'operasional',
    summary: 'Penomoran otomatis surat keluar, pencatatan surat masuk, dan arsip digital.',
    description: 'Mengatur tertib administrasi persuratan resmi madrasah, klasifikasi kode surat, dan disposisi pimpinan.',
    roles: ['super_admin', 'admin_tu', 'kepsek'],
    keyFeatures: ['Penomoran otomatis surat keluar', 'Arsip scan surat masuk', 'Disposisi kepala madrasah'],
    inputs: ['Perihal surat', 'Tujuan/Pengirim', 'Scan berkas'],
    outputs: ['Nomor surat sah', 'Buku agenda surat masuk & keluar'],
  },

  // --- KEPEGAWAIAN ---
  {
    id: 'ckh',
    title: 'Catatan Kinerja Harian (CKH)',
    href: '/dashboard/ckh',
    domain: 'kepegawaian',
    summary: 'Pencatatan aktivitas kerja harian pegawai & guru untuk laporan bulanan resmi.',
    description: 'Guru dan tenaga kependidikan mencatat uraian tugas harian. Di akhir bulan, dokumen dicetak lengkap dengan tanda tangan digital sah Kepala Madrasah.',
    roles: ['guru', 'wali_kelas', 'guru_bk', 'guru_piket', 'admin_tu', 'super_admin', 'kepsek', 'pramubakti', 'satpam'],
    keyFeatures: ['Jurnal aktivitas kerja harian', 'Rekap bulanan otomatis', 'Tanda tangan digital kepala madrasah', 'Ekspor PDF siap cetak'],
    inputs: ['Uraian kegiatan harian', 'Kuantitas/output kerja'],
    outputs: ['Dokumen CKH resmi bulanan ber-barcode/signature'],
  },
  {
    id: 'tpg',
    title: 'Pemberkasan TPG (S36)',
    href: '/dashboard/tpg',
    domain: 'kepegawaian',
    summary: 'Verifikasi berkas persyaratan pencairan Tunjangan Profesi Guru.',
    description: 'Mengelola pengunggahan berkas S36, SKMT, dan kelengkapan administrasi sertifikasi guru untuk verifikasi kemenag.',
    roles: ['guru', 'super_admin', 'admin_tu', 'kepsek'],
    keyFeatures: ['Upload formulir S36 bulanan', 'Validasi kelengkapan berkas', 'Status verifikasi admin TU'],
    inputs: ['File S36 PDF', 'SKMT'],
    outputs: ['Rekapitulasi berkas siap cetak pencairan TPG'],
  },
  {
    id: 'settings-users',
    title: 'Kelola Akun & Hak Akses',
    href: '/dashboard/settings/users',
    domain: 'kepegawaian',
    summary: 'Pengaturan akun pegawai, reset sandi, dan pemetaan peran (multi-role).',
    description: 'Super Admin dan Admin TU mengatur hak akses pengguna. Sistem mendukung satu akun memiliki banyak peran sekaligus (misal: Guru + Wali Kelas + Guru Piket).',
    roles: ['super_admin', 'admin_tu'],
    keyFeatures: ['Manajemen pengguna', 'Penetapan peran ganda (Multi-role)', 'Aktivasi / nonaktif akun'],
    inputs: ['Nama', 'Email', 'Role utama & tambahan', 'NIP/NIK'],
    outputs: ['Akses login pegawai'],
  },

  // --- PORTAL ---
  {
    id: 'portal-ortu',
    title: 'Portal Orang Tua / Santri',
    href: '/portal-ortu',
    domain: 'portal',
    summary: 'Aplikasi web mandiri orang tua untuk memantau anak dan bertransaksi.',
    description: 'Dapat diakses orang tua dari HP tanpa akun email (login menggunakan NISN + Tanggal Lahir). Transparansi penuh untuk presensi, nilai, tagihan, dan komunikasi sekolah.',
    roles: ['parent', 'super_admin'],
    keyFeatures: ['Catatan kehadiran per sesi, izin sesuai jam, dan koreksi harian wali ditampilkan terpisah', 'Rekap setelah pembelajaran selesai dengan prioritas Alfa, Sakit, Izin guru, Hadir', 'Panduan membaca izin resmi yang dihitung Hadir; alasan dan jam tetap tersedia', 'Kalender dan ringkasan menghitung hari yang sudah memiliki hasil harian; sesi belum diinput ditampilkan', 'Jadwal pelajaran hari ini', 'Cek tagihan & upload bukti bayar DSPT', 'Kuitansi pembayaran digital', 'Kotak saran ke sekolah'],
    inputs: ['Login NISN + Tgl Lahir', 'Upload bukti transfer DSPT', 'Saran/masukan'],
    outputs: ['Kuitansi pembayaran anak', 'Catatan sesi, rekap sementara, dan rekap harian setelah pembelajaran selesai', 'Notifikasi rekap beserta alasan hasil dan jumlah sesi yang belum diinput'],
  },
]

export type CoreWorkflow = {
  id: string
  title: string
  subtitle: string
  description: string
  steps: Array<{
    step: number
    actor: string
    title: string
    action: string
    module: string
  }>
}

export const CORE_WORKFLOWS: CoreWorkflow[] = [
  {
    id: 'flow-kbm',
    title: 'Alur KBM Harian & Presensi Realtime',
    subtitle: 'Dari penugasan jam mengajar hingga notifikasi kehadiran ke orang tua',
    description: 'Memastikan proses belajar mengajar tercatat rapi dan wali murid mengetahui posisi santri secara tepat waktu.',
    steps: [
      {
        step: 1,
        actor: 'Wakamad Kurikulum',
        title: 'Penugasan & Jadwal',
        action: 'Menetapkan guru pengampu mapel dan memplot ke slot jadwal mingguan di sistem.',
        module: '/dashboard/penugasan',
      },
      {
        step: 2,
        actor: 'Guru Mata Pelajaran',
        title: 'Buka Kelas & Isi Agenda',
        action: 'Saat jam pelajaran dimulai, guru membuka agenda mengajar, memasukkan materi, dan menandai kehadiran siswa. Lokasi foto kamera Android disimpan sebelum dibaca langsung dari perangkat dan diperkecil ke WebP atau JPEG. Jika kamera bawaan gagal, pengguna memotret melalui preview kamera browser di halaman yang sama. Setelah aplikasi dimuat ulang, draft materi/foto dapat dilanjutkan atau foto diambil lagi jika kamera belum mengembalikan hasil; status diperbarui setelah server mengonfirmasi penyimpanan.',
        module: '/dashboard/agenda',
      },
      {
        step: 3,
        actor: 'Guru Piket',
        title: 'Monitoring Kelas',
        action: 'Memantau kelas yang belum terisi guru. Jika guru berhalangan, menunjuk guru piket pengganti.',
        module: '/dashboard/monitoring-agenda',
      },
      {
        step: 4,
        actor: 'Wali Kelas',
        title: 'Validasi & Izin',
        action: 'Memvalidasi rekap kehadiran kelas dan menambahkan keterangan surat dokter/izin siswa yang berhalangan. Izin keluar komplek yang belum ditandai kembali ditutup otomatis setelah akhir pola jam pelajaran tahun ajaran aktif melalui cron tiap 5 menit; waktu kembali manual tetap dipertahankan dan penutupan otomatis diberi catatan.',
        module: '/dashboard/kelas-binaan',
      },
      {
        step: 5,
        actor: 'Orang Tua (Portal)',
        title: 'Notifikasi & Laporan',
        action: 'Melihat status presensi anak (Hadir/Alfa/Izin) langsung dari ponsel melalui Portal Orang Tua.',
        module: '/portal-ortu',
      },
    ],
  },
  {
    id: 'flow-keuangan',
    title: 'Alur Keuangan & Pembayaran DSPT/SPP',
    subtitle: 'Dari tagihan terbit, pembayaran orang tua, hingga pembukuan arus kas',
    description: 'Menjamin akuntabilitas dana komite tanpa risiko kebocoran dan mempermudah orang tua mendapatkan kuitansi sah.',
    steps: [
      {
        step: 1,
        actor: 'Bendahara Komite',
        title: 'Penetapan Tagihan',
        action: 'Menetapkan nominal target DSPT santri baru dan mengaktifkan tagihan bulanan komite.',
        module: '/dashboard/keuangan/dspt',
      },
      {
        step: 2,
        actor: 'Orang Tua Santri',
        title: 'Pembayaran & Bukti',
        action: 'Membayar transfer via rekening resmi komite, lalu mengunggah screenshot bukti transfer di Portal Orang Tua (atau setor tunai di kantor bendahara).',
        module: '/portal-ortu',
      },
      {
        step: 3,
        actor: 'Bendahara Komite',
        title: 'Verifikasi & Penerimaan',
        action: 'Mengecek mutasi rekening dan menyetujui setoran bukti bayar orang tua.',
        module: '/dashboard/keuangan/verifikasi',
      },
      {
        step: 4,
        actor: 'Sistem MANSATAS',
        title: 'Penerbitan Kuitansi',
        action: 'Otomatis menerbitkan nomor kuitansi digital resmi dan mencatat transaksi ke Buku Kas dan Jurnal Arus Kas.',
        module: '/dashboard/keuangan/kuitansi',
      },
      {
        step: 5,
        actor: 'Ketua Komite & Kepala Madrasah',
        title: 'Audit Arus Kas',
        action: 'Mengecek laporan arus kas masuk, pengeluaran kas belanja, dan posisi saldo kas berjalan.',
        module: '/dashboard/keuangan/arus-kas',
      },
    ],
  },
  {
    id: 'flow-disiplin',
    title: 'Alur Pembinaan & Penegakan Disiplin',
    subtitle: 'Pencatatan pelanggaran, akumulasi poin, bimbingan BK, hingga panggilan orang tua',
    description: 'Sistem pembinaan karakter berjenjang berbasis poin transparan yang melibatkan wali kelas dan guru BK.',
    steps: [
      {
        step: 1,
        actor: 'Guru / Guru Piket',
        title: 'Catat Pelanggaran',
        action: 'Mencatat santri yang melanggar tata tertib (terlambat, atribut, perilaku) sesuai master bobot poin.',
        module: '/dashboard/kedisiplinan',
      },
      {
        step: 2,
        actor: 'Sistem MANSATAS',
        title: 'Akumulasi Poin',
        action: 'Otomatis menambah poin kumulatif santri dan memicu status alert jika melewati batas ambang peringatan.',
        module: '/dashboard/kedisiplinan',
      },
      {
        step: 3,
        actor: 'Wali Kelas & Guru BK',
        title: 'Konseling & Pembinaan',
        action: 'Wali kelas berkoordinasi dengan Guru BK untuk melakukan sesi bimbingan konseling pribadi santri.',
        module: '/dashboard/bk',
      },
      {
        step: 4,
        actor: 'Wakamad Kesiswaan',
        title: 'Surat Panggilan / SP',
        action: 'Menerbitkan Surat Peringatan (SP) atau Surat Panggilan Resmi kepada orang tua santri.',
        module: '/dashboard/kelas-binaan',
      },
      {
        step: 5,
        actor: 'Orang Tua',
        title: 'Konfirmasi Surat',
        action: 'Orang tua menerima notifikasi panggilan dan jadwal kehadiran pertemuan di madrasah melalui Portal Orang Tua.',
        module: '/portal-ortu',
      },
    ],
  },
  {
    id: 'flow-ckh',
    title: 'Alur Kinerja Pegawai & TPG (CKH & S36)',
    subtitle: 'Dari laporan tugas harian, tanda tangan digital kepala madrasah, hingga berkas TPG',
    description: 'Digitalisasi administrasi kepegawaian guru dan staf untuk pencairan tunjangan profesi dan akuntabilitas kinerja.',
    steps: [
      {
        step: 1,
        actor: 'Guru / Pegawai',
        title: 'Input Jurnal CKH',
        action: 'Mencatat aktivitas kerja harian (tugas wajib dan tambahan) secara rutin setiap hari kerja.',
        module: '/dashboard/ckh',
      },
      {
        step: 2,
        actor: 'Sistem MANSATAS',
        title: 'Kompilasi Bulanan',
        action: 'Mengompilasi seluruh catatan harian menjadi dokumen laporan kinerja bulanan terstandar.',
        module: '/dashboard/ckh',
      },
      {
        step: 3,
        actor: 'Kepala Madrasah',
        title: 'Persetujuan & E-Signature',
        action: 'Memeriksa rekapitulasi kinerja bulanan staf dan membubuhkan tanda tangan digital kepala secara batch.',
        module: '/dashboard/ckh-generator',
      },
      {
        step: 4,
        actor: 'Guru Sertifikasi',
        title: 'Upload Berkas S36',
        action: 'Mengunggah formulir S36 dan lampiran CKH sah untuk persyaratan pencairan Tunjangan Profesi Guru.',
        module: '/dashboard/tpg',
      },
    ],
  },
]
