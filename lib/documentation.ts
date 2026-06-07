import { MENU_ITEMS } from '@/config/menu'

export type DocumentationAudience = 'internal' | 'parent'

export type DocumentationArticle = {
  id: string
  audience: DocumentationAudience
  feature_id: string | null
  title: string
  summary: string
  content_md: string
  sort_order: number
  is_published: number
  updated_at: string
}

export type DocumentationInput = {
  id?: string
  audience: DocumentationAudience
  featureId: string | null
  title: string
  summary: string
  contentMd: string
  sortOrder: number
  isPublished: boolean
}

const PARENT_ARTICLES: Array<Omit<DocumentationArticle, 'updated_at'>> = [
  {
    id: 'parent-overview',
    audience: 'parent',
    feature_id: null,
    title: 'Panduan Portal Orang Tua',
    summary: 'Ringkasan penggunaan portal orang tua untuk memantau profil, jadwal, kehadiran, nilai, pembayaran, dan saran.',
    sort_order: 1,
    is_published: 1,
    content_md: [
      '# Panduan Portal Orang Tua',
      '',
      'Portal Orang Tua membantu Bapak/Ibu memantau informasi anak secara mandiri dari satu layar.',
      '',
      '## Menu utama',
      '- Beranda menampilkan profil siswa, wali kelas, ringkasan kehadiran, peringatan penting, dan pengumuman sekolah.',
      '- Jadwal Kelas menampilkan mata pelajaran, guru, jam pelajaran, dan status absensi untuk hari berjalan.',
      '- Kehadiran berisi rekap hadir, sakit, izin, alfa, serta catatan terbaru.',
      '- Akademik menampilkan rata-rata dan rincian nilai semester yang sudah tersedia.',
      '- Keuangan menampilkan status DSPT/SPP, pengajuan pembayaran DSPT, upload bukti, dan kuitansi.',
      '- Kotak Saran dipakai untuk mengirim masukan kepada sekolah dan memantau status tindak lanjut.',
      '',
      '## Praktik yang disarankan',
      '- Periksa pengumuman dan notifikasi secara berkala.',
      '- Hubungi wali kelas melalui tombol WhatsApp jika ada data yang perlu dikonfirmasi.',
      '- Upload bukti pembayaran yang jelas agar bendahara mudah memverifikasi.',
      '- Gunakan Kotak Saran untuk masukan yang perlu dicatat secara resmi.',
    ].join('\n'),
  },
  {
    id: 'parent-finance',
    audience: 'parent',
    feature_id: null,
    title: 'Pembayaran DSPT dan Kuitansi',
    summary: 'Cara membaca tagihan, membuat pengajuan pembayaran, upload bukti, dan membuka kuitansi.',
    sort_order: 2,
    is_published: 1,
    content_md: [
      '# Pembayaran DSPT dan Kuitansi',
      '',
      'Bagian Keuangan dipakai untuk melihat status tagihan dan mengirim bukti pembayaran DSPT.',
      '',
      '## Alur pembayaran DSPT',
      '- Buka menu Keuangan.',
      '- Cek sisa tagihan DSPT dan pastikan nominal yang akan dibayar benar.',
      '- Pilih Bayar DSPT, masukkan nominal, lalu pilih QRIS atau Transfer jika tersedia.',
      '- Setelah pembayaran dilakukan di aplikasi bank/e-wallet, catat pengajuan di portal.',
      '- Upload foto atau screenshot bukti pembayaran.',
      '- Tunggu status berubah menjadi Terkonfirmasi setelah diverifikasi bendahara.',
      '',
      '## Catatan penting',
      '- Portal tidak menarik saldo otomatis; pembayaran tetap dilakukan di luar aplikasi.',
      '- Kuitansi muncul setelah pembayaran dikonfirmasi dan dicatat.',
      '- Jika bukti ditolak, baca alasan penolakan lalu upload ulang bukti yang benar.',
    ].join('\n'),
  },
]

const FEATURE_DOCS: Record<string, { summary: string; sections: string[] }> = {
  dashboard: {
    summary: 'Membaca ringkasan kerja harian, shortcut fitur, status tahun ajaran, dan kartu tugas sesuai role.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat sapaan, role aktif, tahun ajaran aktif, dan kartu ringkasan sesuai peran.',
      '- Membuka shortcut fitur harian seperti agenda, kehadiran, kelas binaan, penugasan, rapat, dan monitoring.',
      '- Untuk role tertentu, melihat keputusan absensi hari ini, penugasan masuk, jadwal mengajar, atau indikator operasional.',
      '## Tombol dan aksi',
      '- Gunakan kartu shortcut untuk langsung membuka fitur terkait.',
      '- Gunakan menu profil di sidebar untuk mengatur akun, tema, dan keluar aplikasi.',
      '- Gunakan tombol notifikasi jika banner push notification muncul.',
      '## Filter dan data',
      '- Data mengikuti role utama, role tambahan, dan fitur yang aktif untuk user.',
      '- Kartu yang muncul berbeda antara Super Admin, Guru, Wali Kelas, Guru BK, Guru Piket, Resepsionis, dan Bendahara.',
    ],
  },
  siswa: {
    summary: 'Mengelola data siswa, impor/ekspor, detail profil, status keluar, mutasi, kelas, dan data kontak.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat daftar siswa beserta NISN, NIS, kelas, status, jenis kelamin, dan informasi penting lain.',
      '- Menambah siswa baru, mengedit biodata, membuka detail siswa, dan menandai siswa keluar jika diizinkan.',
      '- Mengimpor data siswa dari file dan mengekspor data untuk kebutuhan administrasi.',
      '## Tombol dan aksi',
      '- Tambah membuka form input siswa baru.',
      '- Edit membuka form perubahan biodata siswa.',
      '- Detail membuka halaman profil siswa lengkap, termasuk rekap absensi dan data terkait.',
      '- Import dipakai untuk unggah data massal; Export dipakai untuk mengunduh data.',
      '- Tandai Keluar mencatat status keluar siswa dari halaman detail.',
      '## Filter dan pencarian',
      '- Cari berdasarkan nama, NISN, NIS, atau kata kunci lain yang tersedia.',
      '- Filter kelas/status dipakai untuk membatasi daftar siswa yang tampil.',
      '- Pastikan kelas dan status benar sebelum ekspor atau perubahan massal.',
    ],
  },
  kelas: {
    summary: 'Mengelola kelas, wali kelas, anggota kelas, cetak absensi, mutasi siswa, dan assignment guru BK.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat daftar kelas, tingkat, nomor kelas, kelompok, wali kelas, dan jumlah siswa.',
      '- Menambah dan mengedit kelas, membuka detail kelas, menambah siswa ke kelas, serta melakukan mutasi.',
      '- Mencetak blanko absensi kelas dan mengatur guru BK pendamping jika tersedia.',
      '## Tombol dan aksi',
      '- Tambah Kelas membuat kelas baru.',
      '- Edit mengubah tingkat, nomor, kelompok, atau wali kelas.',
      '- Detail membuka daftar anggota kelas.',
      '- Tambah Siswa memasukkan siswa ke kelas.',
      '- Mutasi memindahkan atau mencatat perpindahan siswa.',
      '- Cetak Absensi membuat blanko kehadiran untuk kelas.',
      '## Filter dan data',
      '- Gunakan filter tingkat atau pencarian kelas untuk menemukan kelas.',
      '- Data kelas menjadi rujukan untuk jadwal, absensi, wali kelas, akademik, dan portal orang tua.',
    ],
  },
  plotting: {
    summary: 'Mengelola plotting siswa baru, pengacakan kelas, penjurusan, kelulusan, dan cetak blanko penjurusan.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengelola data siswa baru untuk proses penempatan kelas atau jurusan.',
      '- Melakukan pengacakan, plotting penjurusan, rekap kelulusan, dan pencetakan blanko.',
      '- Menyimpan draft hasil plotting sebelum dipakai sebagai data final.',
      '## Tab dan tombol',
      '- Tab Siswa Baru dipakai untuk menyiapkan peserta plotting.',
      '- Tab Pengacakan dipakai untuk pembagian kelas otomatis.',
      '- Tab Penjurusan dipakai untuk mengelola pilihan jurusan atau hasil peminatan.',
      '- Tab Kelulusan dipakai untuk melihat status kelulusan.',
      '- Cetak membuka blanko atau dokumen hasil penjurusan.',
      '## Filter dan catatan',
      '- Gunakan filter angkatan, tingkat, jurusan, atau status jika tersedia.',
      '- Periksa hasil sebelum disimpan final karena data ini dapat memengaruhi kelas aktif siswa.',
    ],
  },
  akademik: {
    summary: 'Mengelola pusat data akademik, tahun ajaran, mata pelajaran, jadwal mengajar, dan jam pelajaran.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengatur data akademik seperti tahun ajaran, mata pelajaran, penugasan mengajar, dan jadwal.',
      '- Menyusun jadwal pelajaran per kelas, guru, hari, dan jam ke.',
      '- Menyesuaikan jam pelajaran yang menjadi acuan jadwal dan absensi.',
      '## Tombol dan aksi',
      '- Tambah digunakan untuk membuat data akademik baru.',
      '- Edit mengubah data tahun ajaran, mapel, penugasan, atau jadwal.',
      '- Hapus melepas data yang tidak lagi dipakai jika tidak terkunci relasi.',
      '- Simpan Jadwal menyimpan perubahan pada tab jadwal.',
      '## Filter dan data',
      '- Filter tahun ajaran, kelas, guru, mapel, dan hari membantu membaca jadwal.',
      '- Pastikan tahun ajaran aktif benar sebelum mengelola jadwal dan penugasan.',
    ],
  },
  'akademik-nilai': {
    summary: 'Melihat dan mengelola rekap nilai akademik siswa per semester dan mata pelajaran.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membaca rekap nilai semester siswa.',
      '- Mengelola nilai per mata pelajaran jika user diberi hak input atau update.',
      '- Menyiapkan data nilai yang juga dapat dibaca di portal orang tua.',
      '## Tombol dan aksi',
      '- Simpan menyimpan nilai yang dimasukkan.',
      '- Import/Export digunakan jika tersedia untuk olah data nilai massal.',
      '- Refresh atau filter ulang dipakai untuk memuat data sesuai kelas/periode.',
      '## Filter dan data',
      '- Filter kelas, semester, tahun ajaran, siswa, dan mata pelajaran dipakai untuk membatasi data.',
      '- Nilai kosong berarti data belum diinput atau belum tersedia untuk siswa tersebut.',
    ],
  },
  'kalender-pendidikan': {
    summary: 'Mengatur kalender pendidikan, hari efektif, libur, kegiatan, sumber kalender resmi, dan pengecualian KBM.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat kalender pendidikan dalam tampilan tanggal dan daftar agenda.',
      '- Menambah event kalender seperti libur, ujian, kegiatan madrasah, dan hari efektif khusus.',
      '- Mengatur pengecualian KBM untuk tanggal atau jam tertentu.',
      '## Tombol dan aksi',
      '- Tambah Kegiatan/Event membuat entri kalender baru.',
      '- Edit mengubah tanggal, judul, jenis, dan keterangan.',
      '- Hapus menghapus event kalender yang salah.',
      '- Sinkron atau sumber resmi dipakai jika pengaturan sumber kalender tersedia.',
      '## Filter dan data',
      '- Filter bulan/tahun, jenis event, dan status efektif membantu membaca kalender.',
      '- Kalender memengaruhi jadwal dan status absensi, terutama saat libur atau pengecualian KBM.',
    ],
  },
  tahfidz: {
    summary: 'Mengelola data hafalan siswa, juz/surat/ayat, riwayat setoran, analitik, dan cetak laporan tahfidz.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menambah siswa tahfidz dan mencatat capaian hafalan.',
      '- Membuka riwayat setoran per siswa.',
      '- Melihat analitik perkembangan hafalan.',
      '- Mencetak laporan tahfidz.',
      '## Tombol dan aksi',
      '- Tambah Siswa memasukkan siswa ke program tahfidz.',
      '- Riwayat membuka daftar setoran dan perubahan capaian.',
      '- Cetak Laporan membuat dokumen laporan hafalan.',
      '- Simpan Setoran menyimpan juz, surat, ayat, status, dan catatan.',
      '## Filter dan data',
      '- Filter kelas, siswa, juz, surat, status, atau periode dipakai untuk menelusuri data.',
      '- Pastikan ayat awal dan akhir benar sebelum menyimpan setoran.',
    ],
  },
  guru: {
    summary: 'Mengelola data guru/pegawai, akun login, role, multi-role, fitur khusus user, dan profil pegawai.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat daftar guru dan pegawai beserta role, kontak, status akun, dan data profil.',
      '- Menambah atau mengedit data pegawai.',
      '- Mengatur role utama, role tambahan, dan override fitur per user.',
      '- Mengatur nomor WhatsApp atau data kepegawaian yang dipakai fitur lain.',
      '## Tombol dan aksi',
      '- Tambah membuat akun/data guru baru.',
      '- Edit mengubah biodata pegawai.',
      '- Role/Fitur membuka pengaturan role dan akses khusus user.',
      '- Reset atau aksi akun lain digunakan sesuai hak admin.',
      '## Filter dan data',
      '- Cari berdasarkan nama, email, role, atau status.',
      '- Perubahan role dapat mengubah sidebar, dashboard, dan dokumentasi yang terlihat.',
    ],
  },
  kehadiran: {
    summary: 'Menginput absensi siswa per kelas/jadwal, menyimpan status hadir/sakit/izin/alfa, dan catatan absensi.',
    sections: [
      '## Fungsi yang tersedia',
      '- Memilih kelas atau penugasan mengajar lalu menginput absensi siswa.',
      '- Menandai status HADIR, SAKIT, IZIN, atau ALFA.',
      '- Mengisi catatan absensi jika diperlukan.',
      '- Mengunci atau menyimpan sesi absensi sesuai alur halaman.',
      '## Tombol dan aksi',
      '- Pilih Kelas/Jadwal menentukan daftar siswa yang muncul.',
      '- Tombol status pada tiap siswa mengubah kehadiran.',
      '- Simpan Absensi menyimpan seluruh perubahan.',
      '- Refresh memuat ulang daftar dan status terbaru.',
      '## Filter dan data',
      '- Filter tanggal, kelas, jadwal, jam pelajaran, atau penugasan dipakai sebelum input.',
      '- Kalender pendidikan dan pengecualian KBM dapat membuat absensi tidak efektif pada tanggal tertentu.',
    ],
  },
  'kelas-binaan': {
    summary: 'Memantau kelas wali, siswa binaan, agenda, dan input/rekap absensi dari sudut pandang wali kelas.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat daftar kelas binaan dan siswa yang menjadi tanggung jawab wali kelas.',
      '- Memantau kehadiran dan kondisi siswa.',
      '- Mengisi atau menindaklanjuti keterangan absensi bila tersedia.',
      '## Tombol dan aksi',
      '- Pilih Kelas mengganti kelas binaan yang sedang dilihat.',
      '- Detail Siswa membuka informasi siswa.',
      '- Simpan/Update Keterangan menyimpan catatan absensi atau tindak lanjut.',
      '## Filter dan data',
      '- Filter kelas, tanggal, dan status absensi membantu wali kelas membaca data.',
      '- User tanpa assignment wali kelas mungkin hanya melihat data terbatas.',
    ],
  },
  'rekap-absensi': {
    summary: 'Membaca rekap kehadiran siswa per kelas, tanggal, periode, status, dan menyiapkan laporan absensi.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat jumlah hadir, sakit, izin, alfa, dan catatan absensi.',
      '- Membaca rekap per siswa atau per kelas.',
      '- Mengekspor atau mencetak rekap jika tombol tersedia.',
      '## Tombol dan aksi',
      '- Terapkan Filter memuat data sesuai kelas/periode.',
      '- Export/Cetak membuat laporan rekap.',
      '- Reset Filter mengembalikan pilihan awal.',
      '## Filter dan data',
      '- Filter kelas, tanggal awal, tanggal akhir, status, dan siswa dipakai untuk membaca rekap.',
      '- Data berasal dari input Absensi Siswa dan Keterangan Absensi.',
    ],
  },
  'keterangan-absensi': {
    summary: 'Mengelola alasan dan keterangan absensi siswa, terutama izin, sakit, alfa, dan catatan wali kelas.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menambahkan keterangan untuk absensi siswa.',
      '- Mengubah catatan atau alasan izin/sakit/alfa.',
      '- Melihat riwayat keterangan absensi per siswa atau kelas.',
      '## Tombol dan aksi',
      '- Tambah Keterangan membuat catatan baru.',
      '- Edit mengubah alasan atau catatan.',
      '- Simpan menyimpan perubahan keterangan.',
      '## Filter dan data',
      '- Filter tanggal, kelas, siswa, dan status absensi membantu menemukan data.',
      '- Keterangan yang disimpan dapat muncul pada rekap dan detail siswa.',
    ],
  },
  agenda: {
    summary: 'Mencatat agenda guru, materi pembelajaran, jurnal kelas, foto kegiatan, dan agenda piket bila role mendukung.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengisi agenda mengajar harian sesuai jadwal atau penugasan.',
      '- Mencatat materi, catatan kelas, dan dokumentasi gambar.',
      '- Melihat riwayat materi atau agenda sebelumnya.',
      '- Guru piket dapat mengisi agenda piket jika role aktif.',
      '## Tombol dan aksi',
      '- Tambah/Isi Agenda membuka form agenda.',
      '- Upload Gambar menambahkan dokumentasi kegiatan.',
      '- Simpan Agenda menyimpan materi dan catatan.',
      '- Riwayat Materi membuka daftar agenda yang pernah diinput.',
      '## Filter dan data',
      '- Filter tanggal, kelas, jadwal, penugasan, dan guru dipakai untuk menemukan agenda.',
      '- Pastikan jadwal mengajar sudah benar agar pilihan agenda muncul.',
    ],
  },
  'agenda-kelas': {
    summary: 'Membaca dan mencetak agenda kelas berdasarkan kelas, tanggal, mapel, guru, dan materi.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat agenda yang sudah diinput guru untuk kelas tertentu.',
      '- Menyusun laporan agenda kelas.',
      '- Mencetak template atau rekap agenda kelas jika tersedia.',
      '## Tombol dan aksi',
      '- Terapkan Filter memuat agenda sesuai kelas dan periode.',
      '- Cetak/Export menghasilkan dokumen agenda.',
      '- Detail membuka catatan agenda lebih lengkap.',
      '## Filter dan data',
      '- Filter kelas, tanggal, guru, mapel, dan tahun ajaran membantu pencarian.',
      '- Data bersumber dari input Agenda Guru.',
    ],
  },
  'ckh-generator': {
    summary: 'Membuat Catatan Kinerja Harian, template personal, tanda tangan, dan dokumen CKH siap cetak.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengisi kegiatan harian pegawai/guru.',
      '- Menggunakan template personal untuk mempercepat input CKH.',
      '- Mengatur data tanda tangan dan mencetak dokumen CKH.',
      '## Tombol dan aksi',
      '- Tambah Kegiatan menambahkan baris CKH.',
      '- Template menyimpan atau memakai pola kegiatan berulang.',
      '- Generate/Cetak membuat dokumen CKH.',
      '- Print Toolbar dipakai saat membuka dokumen cetak.',
      '## Filter dan data',
      '- Filter tanggal, bulan, pegawai, atau periode dipakai saat membuat laporan.',
      '- Pastikan nama, jabatan, pangkat/golongan, dan tanda tangan sudah benar.',
    ],
  },
  'tpg-dokumen': {
    summary: 'Menyiapkan dokumen TPG, data S36, CKH terkait, dan arsip dokumen untuk kebutuhan tunjangan profesi.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengelola kelengkapan dokumen TPG.',
      '- Mengunduh dokumen S36 jika tersedia.',
      '- Membuka dokumen CKH terkait untuk cetak atau verifikasi.',
      '## Tombol dan aksi',
      '- Upload/Tambah Dokumen menambahkan berkas pendukung.',
      '- Download mengunduh dokumen yang tersedia.',
      '- Cetak CKH membuka dokumen cetak.',
      '- Simpan menyimpan data metadata dokumen.',
      '## Filter dan data',
      '- Filter periode, guru, status, atau jenis dokumen membantu pemeriksaan.',
      '- Pastikan data guru dan pangkat/golongan sudah lengkap sebelum cetak.',
    ],
  },
  documentation: {
    summary: 'Membaca panduan aplikasi sesuai fitur aktif dan mengelola artikel dokumentasi bagi Super Admin.',
    sections: [
      '## Fungsi yang tersedia',
      '- User membaca dokumentasi sesuai fitur yang aktif untuk akun tersebut.',
      '- Super Admin dapat membuat, mengedit, publish/unpublish, dan mengurutkan artikel.',
      '- Dokumentasi orang tua dikelola dari editor yang sama dengan audience Portal Orang Tua.',
      '## Tombol dan aksi',
      '- Cari Dokumentasi mencari judul, ringkasan, fitur, dan isi artikel.',
      '- Pilih artikel di daftar kiri untuk membaca isi.',
      '- Edit membuka editor artikel yang sedang dibaca.',
      '- Dokumentasi tombol tambah di kanan bawah membuat artikel baru.',
      '## Filter dan data',
      '- Artikel internal muncul sesuai allowed feature user.',
      '- Artikel umum tanpa fitur muncul untuk semua user internal.',
      '- Artikel unpublished hanya dikelola Super Admin dan tidak tampil ke user biasa.',
    ],
  },
  'rppm-generator': {
    summary: 'Membuat RPPM, memilih kelas/tema/periode, menyusun materi, dan mencetak dokumen pembelajaran.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengisi data RPPM seperti kelas, periode, tema, tujuan, kegiatan, dan asesmen.',
      '- Menyimpan rancangan RPPM.',
      '- Mencetak dokumen RPPM.',
      '## Tombol dan aksi',
      '- Tambah/Generate RPPM membuat dokumen baru.',
      '- Simpan menyimpan rancangan.',
      '- Cetak membuka template dokumen RPPM.',
      '- Reset mengosongkan form jika tersedia.',
      '## Filter dan data',
      '- Pilih kelas, semester, minggu/periode, tema, dan guru sebelum generate.',
      '- Pastikan data pembelajaran lengkap agar dokumen cetak tidak kosong.',
    ],
  },
  'nilai-harian': {
    summary: 'Menginput nilai harian siswa berdasarkan kelas, mata pelajaran, guru, periode, dan komponen penilaian.',
    sections: [
      '## Fungsi yang tersedia',
      '- Memilih kelas dan mata pelajaran lalu menginput nilai siswa.',
      '- Menyimpan nilai harian per komponen atau per tanggal.',
      '- Melihat daftar nilai yang sudah diinput.',
      '## Tombol dan aksi',
      '- Pilih Kelas/Mapel memuat daftar siswa.',
      '- Simpan Nilai menyimpan input nilai.',
      '- Tambah Komponen menambah kolom penilaian jika tersedia.',
      '- Export dipakai jika halaman menyediakan unduhan data.',
      '## Filter dan data',
      '- Filter tahun ajaran, kelas, mapel, guru, tanggal, atau komponen dipakai sebelum input.',
      '- Pastikan siswa yang tampil sesuai kelas aktif.',
    ],
  },
  penugasan: {
    summary: 'Membuat, menerima, memantau, dan menindaklanjuti penugasan antar pegawai/guru.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membuat tugas untuk user lain.',
      '- Melihat daftar tugas masuk dan tugas yang dibuat.',
      '- Mengubah status penugasan dan mengisi catatan tindak lanjut.',
      '## Tombol dan aksi',
      '- Buat/Tambah Penugasan membuka form tugas baru.',
      '- Simpan mengirim tugas.',
      '- Tandai Selesai menyelesaikan tugas.',
      '- Detail membuka instruksi dan riwayat tugas.',
      '## Filter dan data',
      '- Filter status, penerima, pembuat, tanggal, dan prioritas membantu memantau tugas.',
      '- Monitoring Penugasan dipakai pimpinan/admin untuk melihat penugasan lintas user.',
    ],
  },
  whatsapp: {
    summary: 'Mengirim pesan WhatsApp terarah untuk siswa, orang tua, atau kebutuhan komite sesuai izin.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menyusun pesan WhatsApp dan memilih target penerima.',
      '- Mengirim pesan untuk informasi sekolah, keuangan, atau komunikasi tertentu.',
      '- Memakai data nomor WhatsApp yang tersimpan pada siswa/user.',
      '## Tombol dan aksi',
      '- Pilih Target menentukan penerima pesan.',
      '- Kirim WhatsApp mengirim pesan.',
      '- Preview memeriksa isi pesan jika tersedia.',
      '- Reset membersihkan form.',
      '## Filter dan data',
      '- Filter kelas, siswa, role, kategori, atau status pembayaran dapat tersedia sesuai konteks.',
      '- Pastikan nomor WhatsApp valid dengan format Indonesia sebelum mengirim.',
    ],
  },
  'monitoring-agenda': {
    summary: 'Memantau agenda guru, keterisian jurnal, materi yang sudah diinput, dan kepatuhan pengisian.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat guru/kelas yang sudah atau belum mengisi agenda.',
      '- Membaca ringkasan agenda per periode.',
      '- Membuka detail agenda untuk pemeriksaan.',
      '## Tombol dan aksi',
      '- Terapkan Filter memuat data monitoring.',
      '- Detail membuka catatan agenda.',
      '- Export/Cetak digunakan jika tersedia untuk laporan.',
      '## Filter dan data',
      '- Filter tanggal, kelas, guru, mapel, dan status pengisian dipakai untuk audit.',
      '- Data berasal dari fitur Agenda Guru.',
    ],
  },
  'monitoring-penugasan': {
    summary: 'Memantau penugasan lintas user berdasarkan status, pembuat, penerima, prioritas, dan tanggal.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat semua penugasan yang relevan untuk monitoring pimpinan/admin.',
      '- Memeriksa status tugas, penerima, tenggat, dan catatan.',
      '- Menindaklanjuti tugas yang belum selesai atau terlambat.',
      '## Tombol dan aksi',
      '- Filter memuat daftar sesuai kriteria.',
      '- Detail membuka isi tugas.',
      '- Export/Cetak digunakan jika tersedia.',
      '## Filter dan data',
      '- Filter status, penerima, pembuat, rentang tanggal, dan prioritas.',
      '- Data berasal dari fitur Penugasan.',
    ],
  },
  'monitoring-kedisiplinan': {
    summary: 'Memantau pelanggaran siswa, poin, sanksi, kelas, kategori pelanggaran, dan tindak lanjut.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat akumulasi poin dan kasus pelanggaran siswa.',
      '- Membaca rekap per kelas, kategori, tingkat sanksi, dan periode.',
      '- Membuka detail catatan pelanggaran untuk tindak lanjut.',
      '## Tombol dan aksi',
      '- Terapkan Filter memuat rekap kedisiplinan.',
      '- Detail membuka daftar kasus siswa.',
      '- Export/Cetak digunakan jika tersedia.',
      '## Filter dan data',
      '- Filter kelas, siswa, tanggal, kategori pelanggaran, status, dan level sanksi.',
      '- Data berasal dari fitur Kedisiplinan dan konfigurasi sanksi.',
    ],
  },
  rapat: {
    summary: 'Membuat undangan rapat, mengatur peserta, jadwal, lokasi, agenda, dan memantau undangan.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membuat undangan rapat untuk guru/pegawai.',
      '- Mengatur tanggal, waktu, tempat, agenda, dan peserta.',
      '- Melihat daftar undangan rapat yang diterima atau dibuat.',
      '## Tombol dan aksi',
      '- Buat Undangan membuat rapat baru.',
      '- Edit mengubah detail rapat.',
      '- Hapus membatalkan undangan jika diizinkan.',
      '- Detail membuka informasi rapat lengkap.',
      '## Filter dan data',
      '- Filter tanggal, status, peserta, atau pembuat membantu mencari rapat.',
      '- Pastikan peserta benar sebelum undangan disimpan.',
    ],
  },
  'jadwal-piket': {
    summary: 'Mengelola jadwal guru piket, shift, hari, petugas, dan agenda piket.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menyusun jadwal guru piket per hari atau shift.',
      '- Mengatur daftar petugas piket.',
      '- Menjadi rujukan untuk agenda piket dan operasional harian.',
      '## Tombol dan aksi',
      '- Tambah Jadwal menambah petugas/shift.',
      '- Edit mengubah hari, shift, atau guru.',
      '- Hapus menghapus jadwal yang salah.',
      '- Simpan menyimpan perubahan jadwal.',
      '## Filter dan data',
      '- Filter hari, guru, atau periode dipakai saat daftar jadwal panjang.',
      '- Pastikan guru yang dipilih aktif dan memiliki role yang sesuai.',
    ],
  },
  izin: {
    summary: 'Mengelola perizinan siswa keluar/masuk, alasan izin, status izin, dan catatan petugas/wali kelas.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mencatat izin siswa berdasarkan alasan, waktu, dan petugas.',
      '- Mengelola master alasan izin.',
      '- Melihat status dan riwayat perizinan siswa.',
      '## Tombol dan aksi',
      '- Tambah Izin membuka form izin baru.',
      '- Kelola Alasan mengatur daftar alasan izin.',
      '- Edit mengubah data izin.',
      '- Simpan menyimpan izin atau alasan.',
      '## Filter dan data',
      '- Filter tanggal, kelas, siswa, status, dan alasan izin membantu pencarian.',
      '- Role satpam/resepsionis/guru piket/wali kelas dapat melihat aksi berbeda.',
    ],
  },
  kedisiplinan: {
    summary: 'Mencatat pelanggaran siswa, master pelanggaran, sanksi, poin, analitik, dan tindak lanjut kedisiplinan.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mencatat kasus pelanggaran siswa beserta tanggal, kategori, poin, dan catatan.',
      '- Mengelola master pelanggaran dan konfigurasi sanksi.',
      '- Melihat analitik kedisiplinan dan rekap kasus.',
      '## Tombol dan aksi',
      '- Tambah Pelanggaran membuka form kasus baru.',
      '- Master/Konfigurasi membuka pengaturan pelanggaran dan sanksi.',
      '- Edit mengubah data kasus.',
      '- Hapus menghapus kasus jika hak akses mengizinkan.',
      '## Filter dan data',
      '- Filter tanggal, kelas, siswa, kategori, level sanksi, dan status tindak lanjut.',
      '- Poin pelanggaran dapat memicu informasi sanksi di portal orang tua.',
    ],
  },
  sarpras: {
    summary: 'Mengelola aset sarana prasarana, kategori, kondisi, lokasi, statistik, dan riwayat aset.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mencatat aset sarpras beserta kategori, lokasi, kondisi, jumlah, dan keterangan.',
      '- Mengelola kategori aset.',
      '- Melihat statistik aset berdasarkan kondisi atau kategori.',
      '## Tombol dan aksi',
      '- Tambah Aset membuka form aset baru.',
      '- Edit mengubah data aset.',
      '- Hapus menghapus aset jika diizinkan.',
      '- Kategori mengelola daftar kategori.',
      '## Filter dan data',
      '- Filter kategori, lokasi, kondisi, status, atau pencarian nama aset.',
      '- Pastikan data kondisi diperbarui saat ada kerusakan atau perpindahan aset.',
    ],
  },
  bk: {
    summary: 'Mengelola rekaman bimbingan konseling, tindak lanjut, pemanggilan orang tua, dan catatan siswa.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mencatat kasus atau layanan BK untuk siswa.',
      '- Menambahkan tindak lanjut seperti konseling, kolaborasi orang tua, atau pemanggilan.',
      '- Melihat riwayat rekaman BK siswa.',
      '## Tombol dan aksi',
      '- Tambah Rekaman membuat catatan BK baru.',
      '- Edit mengubah catatan atau tindak lanjut.',
      '- Simpan Tindak Lanjut menyimpan hasil penanganan.',
      '- Detail membuka riwayat siswa.',
      '## Filter dan data',
      '- Filter siswa, kelas, guru BK, tanggal, kategori, dan tindak lanjut.',
      '- Tindak lanjut pemanggilan/kolaborasi dapat muncul sebagai notifikasi portal orang tua.',
    ],
  },
  psikotes: {
    summary: 'Mengelola data psikotes, minat, bakat, hasil asesmen, dan catatan peminatan siswa.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mencatat hasil psikotes atau asesmen minat siswa.',
      '- Membaca data peminatan untuk dukungan BK dan akademik.',
      '- Menyimpan rekomendasi atau catatan hasil.',
      '## Tombol dan aksi',
      '- Tambah Data membuat hasil psikotes baru.',
      '- Edit mengubah skor, minat, rekomendasi, atau catatan.',
      '- Simpan menyimpan perubahan.',
      '## Filter dan data',
      '- Filter kelas, siswa, tahun, jenis tes, dan status input.',
      '- Gunakan data ini sebagai pendukung, bukan satu-satunya dasar keputusan.',
    ],
  },
  analitik: {
    summary: 'Melihat analitik akademik, indikator kelas/siswa, pengaturan panel, dan tren data akademik.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membaca ringkasan performa akademik siswa atau kelas.',
      '- Melihat grafik/tren dan indikator yang tersedia.',
      '- Mengatur panel analitik jika role memiliki izin.',
      '## Tombol dan aksi',
      '- Terapkan Filter memuat analitik sesuai pilihan.',
      '- Pengaturan membuka konfigurasi panel.',
      '- Export/Cetak digunakan jika tersedia.',
      '## Filter dan data',
      '- Filter tahun ajaran, kelas, tingkat, semester, siswa, atau mapel.',
      '- Data bergantung pada kelengkapan nilai dan data akademik.',
    ],
  },
  tka: {
    summary: 'Mengelola data TKA, mapel pilihan, hasil, rekap, dan analitik kesiapan siswa.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengelola pilihan mapel TKA siswa.',
      '- Menginput atau membaca hasil TKA.',
      '- Melihat rekap dan analitik TKA.',
      '## Tab dan tombol',
      '- Tab Mapel Pilihan mengatur pilihan siswa.',
      '- Tab Hasil menampilkan atau menginput hasil.',
      '- Tab Rekap membaca rangkuman data.',
      '- Tab Analitik membaca grafik/indikator.',
      '## Filter dan data',
      '- Filter kelas, siswa, mapel, status, dan periode.',
      '- Pastikan data pilihan mapel benar sebelum rekap digunakan.',
    ],
  },
  'penerimaan-pt': {
    summary: 'Mengelola data penerimaan perguruan tinggi, jalur masuk, status siswa, kampus, dan program studi.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mencatat siswa yang mendaftar atau diterima di perguruan tinggi.',
      '- Mengelola kampus, program studi, jalur, dan status penerimaan.',
      '- Membaca rekap penerimaan PT.',
      '## Tombol dan aksi',
      '- Tambah Data membuat catatan penerimaan.',
      '- Edit mengubah kampus, prodi, jalur, atau status.',
      '- Hapus menghapus data jika diizinkan.',
      '- Export/Cetak digunakan jika tersedia.',
      '## Filter dan data',
      '- Filter tahun lulus, kelas, jalur, kampus, prodi, dan status.',
      '- Data membantu laporan alumni dan evaluasi layanan akademik/BK.',
    ],
  },
  surat: {
    summary: 'Membuat surat keluar seperti surat aktif, mutasi, penelitian, panggilan, dan template surat lainnya.',
    sections: [
      '## Fungsi yang tersedia',
      '- Memilih jenis surat dan mengisi data penerima/siswa/keperluan.',
      '- Generate surat berdasarkan template.',
      '- Mencetak atau menyimpan dokumen surat keluar.',
      '## Tombol dan aksi',
      '- Pilih Jenis Surat menentukan template.',
      '- Generate/Buat Surat menyusun dokumen.',
      '- Cetak membuka tampilan print.',
      '- Simpan menyimpan arsip surat jika tersedia.',
      '## Filter dan data',
      '- Filter jenis surat, tanggal, siswa, atau nomor surat dipakai untuk riwayat.',
      '- Pastikan data kop surat, pejabat, dan nomor surat benar sebelum cetak.',
    ],
  },
  'kelola-ppl': {
    summary: 'Mengelola guru PPL, mapping guru pamong, akses kelas/mapel, dan penugasan PPL.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menentukan guru PPL dan relasi pendamping/pamong.',
      '- Mengatur kelas atau mapel yang bisa diakses guru PPL.',
      '- Membaca daftar assignment PPL.',
      '## Tombol dan aksi',
      '- Tambah Mapping membuat relasi PPL baru.',
      '- Edit mengubah guru PPL, pamong, kelas, atau mapel.',
      '- Hapus melepas assignment yang tidak berlaku.',
      '## Filter dan data',
      '- Filter guru PPL, guru pamong, kelas, mapel, dan status.',
      '- Assignment ini memengaruhi fitur yang bisa dikerjakan guru PPL.',
    ],
  },
  'buku-tamu': {
    summary: 'Mencatat tamu, tujuan kunjungan, waktu masuk/keluar, petugas penerima, dan rekap buku tamu.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menginput tamu yang datang ke madrasah.',
      '- Mencatat nama, instansi, tujuan, orang yang ditemui, waktu, dan catatan.',
      '- Admin dapat membaca rekap atau mengelola data tamu.',
      '## Tombol dan aksi',
      '- Tambah Tamu membuka form kunjungan.',
      '- Simpan menyimpan data tamu.',
      '- Checkout/Selesai mencatat tamu selesai berkunjung jika tersedia.',
      '- Admin View membuka pengelolaan data lebih lengkap.',
      '## Filter dan data',
      '- Filter tanggal, tujuan, status kunjungan, atau kata kunci tamu.',
      '- Resepsionis biasanya fokus pada input harian.',
    ],
  },
  'keuangan-transaksi': {
    summary: 'Melihat riwayat transaksi komite, kuitansi, metode bayar, input oleh, void, dan detail pembayaran.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membaca riwayat transaksi DSPT/SPP dan pembayaran lain yang tercatat.',
      '- Membuka detail transaksi dan kuitansi.',
      '- Melihat metode bayar, nomor kuitansi, siswa, dan petugas input.',
      '## Tombol dan aksi',
      '- Detail membuka rincian transaksi.',
      '- Kuitansi/Cetak membuka bukti pembayaran.',
      '- Void/Batalkan digunakan jika transaksi perlu dibatalkan dan role mengizinkan.',
      '## Filter dan data',
      '- Filter tanggal, siswa, kelas, kategori, metode bayar, status void, dan nomor kuitansi.',
      '- Pastikan transaksi yang dibatalkan memiliki alasan audit yang jelas.',
    ],
  },
  'keuangan-daftar-ulang': {
    summary: 'Kasir daftar ulang untuk mencatat pembayaran, memilih siswa, nominal, metode, dan menerbitkan kuitansi.',
    sections: [
      '## Fungsi yang tersedia',
      '- Memilih siswa dan mencatat pembayaran daftar ulang.',
      '- Mengatur nominal pembayaran, metode bayar, dan catatan.',
      '- Menerbitkan transaksi/kuitansi setelah pembayaran disimpan.',
      '## Tombol dan aksi',
      '- Cari/Pilih Siswa menentukan siswa yang membayar.',
      '- Tambah Pembayaran atau Simpan Transaksi mencatat pembayaran.',
      '- Cetak Kuitansi membuka bukti pembayaran.',
      '## Filter dan data',
      '- Filter siswa, kelas, tahun masuk, status pembayaran, dan tanggal transaksi.',
      '- Periksa nominal sebelum simpan karena transaksi masuk ke riwayat keuangan.',
    ],
  },
  'keuangan-dspt': {
    summary: 'Mengelola target DSPT, pembayaran, diskon, status lunas, pengajuan orang tua, dan buku besar siswa.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat dan mengatur nominal target DSPT per siswa.',
      '- Mencatat pembayaran dan diskon DSPT.',
      '- Memverifikasi pengajuan pembayaran dari portal orang tua.',
      '- Membuka buku besar siswa untuk riwayat pembayaran.',
      '## Tombol dan aksi',
      '- Tambah DSPT membuat target tagihan.',
      '- Bayar/Catat Pembayaran menyimpan transaksi.',
      '- Diskon mengurangi tagihan sesuai kebijakan.',
      '- Konfirmasi/Tolak memproses bukti pembayaran orang tua.',
      '- Detail/Buku Besar membuka riwayat siswa.',
      '## Filter dan data',
      '- Filter kelas, siswa, tahun masuk, status lunas, status pengajuan, dan tanggal.',
      '- Bukti yang ditolak perlu alasan agar orang tua bisa upload ulang.',
    ],
  },
  'keuangan-spp': {
    summary: 'Mengelola tagihan SPP, saldo awal, pembayaran bulanan, status tunggakan, dan kuitansi.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membaca tagihan SPP per siswa dan bulan.',
      '- Mencatat pembayaran SPP dan saldo awal.',
      '- Melihat sisa tunggakan dan status pembayaran.',
      '## Tombol dan aksi',
      '- Bayar SPP mencatat transaksi pembayaran.',
      '- Edit Tagihan/Saldo mengubah data tagihan jika diizinkan.',
      '- Cetak Kuitansi membuka bukti pembayaran.',
      '- Detail Siswa membuka buku besar keuangan siswa.',
      '## Filter dan data',
      '- Filter kelas, siswa, bulan, tahun, status lunas, dan tanggal transaksi.',
      '- Pastikan bulan pembayaran benar sebelum menyimpan transaksi.',
    ],
  },
  'keuangan-export': {
    summary: 'Mengekspor data keuangan DSPT/SPP, transaksi, tagihan, pembayaran, dan rekap ke Excel.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menyiapkan file Excel untuk laporan keuangan.',
      '- Memilih jenis data yang akan diekspor.',
      '- Mengunduh hasil export sesuai filter.',
      '## Tombol dan aksi',
      '- Pilih Jenis Export menentukan data DSPT, SPP, transaksi, atau rekap.',
      '- Terapkan Filter membatasi data.',
      '- Export Excel mengunduh file.',
      '## Filter dan data',
      '- Filter kelas, siswa, tanggal, kategori, tahun ajaran, status pembayaran, atau periode.',
      '- Export hanya menampilkan data sesuai hak akses user.',
    ],
  },
  'keuangan-kas-keluar': {
    summary: 'Mencatat pengeluaran kas komite, kategori, nominal, penerima, tanggal, bukti, dan catatan audit.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menambah transaksi kas keluar.',
      '- Mengedit atau menghapus data pengeluaran jika diizinkan.',
      '- Membaca riwayat pengeluaran kas.',
      '## Tombol dan aksi',
      '- Tambah Kas Keluar membuka form pengeluaran.',
      '- Simpan menyimpan nominal, kategori, dan catatan.',
      '- Edit mengubah transaksi pengeluaran.',
      '- Hapus membatalkan data yang salah jika diizinkan.',
      '## Filter dan data',
      '- Filter tanggal, kategori, penerima, nominal, atau kata kunci.',
      '- Simpan bukti/catatan yang jelas untuk kebutuhan audit.',
    ],
  },
  'keuangan-laporan': {
    summary: 'Membaca laporan keuangan komite, pemasukan, pengeluaran, saldo, kategori, dan ringkasan periode.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat ringkasan pemasukan dan pengeluaran.',
      '- Membaca saldo, rekap kategori, dan daftar transaksi periode tertentu.',
      '- Mencetak atau mengekspor laporan jika tersedia.',
      '## Tombol dan aksi',
      '- Terapkan Filter memuat laporan sesuai periode.',
      '- Export/Cetak membuat laporan.',
      '- Detail membuka rincian transaksi.',
      '## Filter dan data',
      '- Filter tanggal awal, tanggal akhir, kategori, kelas, siswa, dan jenis transaksi.',
      '- Data berasal dari transaksi keuangan, DSPT, SPP, daftar ulang, dan kas keluar.',
    ],
  },
  'keuangan-pengaturan': {
    summary: 'Mengatur rekening komite, QRIS, WhatsApp konfirmasi, nominal, dan preferensi pembayaran portal orang tua.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengatur rekening transfer aktif.',
      '- Mengaktifkan atau menonaktifkan QRIS.',
      '- Mengatur nomor WhatsApp komite untuk konsultasi pembayaran.',
      '- Mengatur data tampilan pembayaran pada portal orang tua.',
      '## Tombol dan aksi',
      '- Tambah Rekening menambahkan rekening baru.',
      '- Simpan Pengaturan menyimpan rekening, QRIS, dan WhatsApp.',
      '- Aktif/Nonaktif mengubah metode pembayaran yang tersedia.',
      '## Filter dan data',
      '- Tidak semua pengaturan memakai filter; fokus pada form konfigurasi.',
      '- Perubahan di sini langsung memengaruhi instruksi pembayaran di Portal Orang Tua.',
    ],
  },
  settings: {
    summary: 'Mengatur profil aplikasi, preferensi sistem, akses halaman pengaturan, dan konfigurasi umum.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membuka pengaturan aplikasi dan akun yang tersedia untuk role.',
      '- Mengakses subfitur seperti profil, notifikasi, jadwal notifikasi, dan manajemen fitur sesuai izin.',
      '- Mengelola informasi dasar sistem jika tersedia.',
      '## Tombol dan aksi',
      '- Buka Profil untuk mengubah data akun pribadi.',
      '- Buka Manajemen Fitur untuk pengaturan role dan menu.',
      '- Buka Broadcast atau Notifikasi Terjadwal jika fitur aktif.',
      '## Filter dan data',
      '- Halaman pengaturan sebagian besar berupa form konfigurasi.',
      '- Aksi yang tampil bergantung pada role dan feature permission.',
    ],
  },
  'settings-fitur': {
    summary: 'Mengelola role, fitur per role, hak CRUD, label fitur, sidebar, bottom nav, dan override user.',
    sections: [
      '## Fungsi yang tersedia',
      '- Mengaktifkan/menonaktifkan fitur untuk setiap role.',
      '- Mengatur hak Create, Read, Update, Delete per role dan fitur.',
      '- Membuat/mengedit role custom.',
      '- Rename label fitur tanpa mengubah route.',
      '- Mengatur susunan sidebar dan bottom nav per role.',
      '## Tab dan tombol',
      '- Per Fitur mengatur role yang boleh mengakses fitur tertentu.',
      '- Per Role mengatur semua fitur untuk satu role.',
      '- Hak CRUD mengatur create/read/update/delete.',
      '- Kelola Role membuat atau mengubah role.',
      '- Sidebar mengatur grup dan urutan menu.',
      '- Bottom Nav mengatur shortcut mobile maksimal lima menu.',
      '## Filter dan data',
      '- Cari fitur untuk menemukan feature_id atau label.',
      '- Perubahan langsung memengaruhi sidebar, akses halaman, dan dokumentasi user.',
    ],
  },
  'settings-notifications': {
    summary: 'Mengirim broadcast/push notification kepada user sesuai target role atau kebutuhan sistem.',
    sections: [
      '## Fungsi yang tersedia',
      '- Menyusun judul dan isi broadcast.',
      '- Memilih target penerima notifikasi.',
      '- Mengirim notifikasi kepada user yang sudah mengaktifkan push notification.',
      '## Tombol dan aksi',
      '- Kirim Broadcast mengirim pesan.',
      '- Pilih Target menentukan penerima.',
      '- Reset membersihkan form jika tersedia.',
      '## Filter dan data',
      '- Target dapat berupa role, user, atau kategori sesuai implementasi halaman.',
      '- User harus pernah mengizinkan push notification agar bisa menerima notifikasi perangkat.',
    ],
  },
  'settings-jadwal-notif': {
    summary: 'Mengelola notifikasi terjadwal, waktu kirim, target, pesan, dan status aktif/nonaktif.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membuat jadwal notifikasi otomatis.',
      '- Mengatur waktu, target, judul, isi pesan, dan status aktif.',
      '- Mengedit atau menonaktifkan jadwal yang tidak dipakai.',
      '## Tombol dan aksi',
      '- Tambah Jadwal membuat notifikasi baru.',
      '- Edit mengubah jadwal.',
      '- Aktif/Nonaktif mengubah status pengiriman.',
      '- Hapus menghapus jadwal.',
      '## Filter dan data',
      '- Filter status, target, atau kata kunci membantu mencari jadwal.',
      '- Jadwal berjalan melalui endpoint cron/reminder sesuai konfigurasi aplikasi.',
    ],
  },
  'pengumuman-ortu': {
    summary: 'Membuat pengumuman untuk orang tua, menentukan target kelas/angkatan/semua, jadwal publish, dan masa berlaku.',
    sections: [
      '## Fungsi yang tersedia',
      '- Membuat pengumuman portal orang tua.',
      '- Menentukan target semua orang tua, kelas tertentu, atau angkatan.',
      '- Mengatur publish_at, expires_at, dan status aktif.',
      '## Tombol dan aksi',
      '- Buat Pengumuman membuka form baru.',
      '- Edit mengubah judul, isi, target, atau masa berlaku.',
      '- Aktif/Nonaktif mengatur apakah pengumuman tampil.',
      '- Hapus menghapus pengumuman jika diizinkan.',
      '## Filter dan data',
      '- Filter status, target, kelas, atau tanggal publish.',
      '- Pengumuman hanya muncul di portal orang tua jika aktif dan masih dalam periode berlaku.',
    ],
  },
  'kotak-saran-ortu': {
    summary: 'Membaca, memproses, dan menutup saran orang tua berdasarkan kategori, status, siswa, dan waktu kirim.',
    sections: [
      '## Fungsi yang tersedia',
      '- Melihat saran yang dikirim orang tua dari portal.',
      '- Mengubah status saran menjadi dibaca, diproses, atau selesai.',
      '- Membaca kategori, judul, isi, siswa, dan waktu kirim.',
      '## Tombol dan aksi',
      '- Detail membuka isi saran lengkap.',
      '- Ubah Status menandai progres tindak lanjut.',
      '- Filter memuat daftar sesuai kategori atau status.',
      '## Filter dan data',
      '- Filter kategori, status, kelas, siswa, dan rentang tanggal.',
      '- Riwayat status dapat dilihat orang tua dari portal.',
    ],
  },
}

const DEFAULT_FEATURE_DOC = {
  summary: 'Panduan operasional fitur, tombol, filter, dan catatan akses.',
  sections: [
    '## Fungsi yang tersedia',
    '- Membaca data utama pada halaman.',
    '- Melakukan input atau perubahan jika hak akses mengizinkan.',
    '- Membuka detail, cetak, export, atau pengaturan sesuai tombol yang tersedia.',
    '## Tombol dan aksi',
    '- Tambah membuat data baru.',
    '- Edit mengubah data yang sudah ada.',
    '- Hapus menghapus data jika diizinkan.',
    '- Simpan menyimpan form.',
    '- Cetak/Export membuat dokumen atau file unduhan jika tersedia.',
    '## Filter dan data',
    '- Gunakan pencarian, kelas, siswa, tanggal, status, dan periode jika tersedia.',
    '- Pastikan filter benar sebelum menyimpan atau mencetak data.',
  ],
}

function buildFeatureArticle(feature: typeof MENU_ITEMS[number], index: number): Omit<DocumentationArticle, 'updated_at'> {
  const doc = FEATURE_DOCS[feature.id] || DEFAULT_FEATURE_DOC
  return {
    id: `feature-${feature.id}`,
    audience: 'internal',
    feature_id: feature.id,
    title: `Panduan ${feature.title}`,
    summary: doc.summary,
    sort_order: (index + 1) * 10,
    is_published: 1,
    content_md: [
      `# Panduan ${feature.title}`,
      '',
      `Lokasi menu: ${feature.href}.`,
      '',
      ...doc.sections,
      '',
      '## Hak akses dan batasan',
      '- Menu hanya tampil jika fitur aktif untuk role atau user Anda.',
      '- Tombol tambah, edit, hapus, export, cetak, dan aksi lain dapat disembunyikan oleh hak CRUD.',
      '- Data yang tampil dapat dibatasi oleh role, kelas binaan, penugasan, atau konteks siswa/pegawai.',
      '- Jika ada tombol yang tidak muncul, minta Super Admin memeriksa Manajemen Fitur dan hak CRUD.',
    ].join('\n'),
  }
}

function getSeedArticles() {
  return [
    {
      id: 'internal-overview',
      audience: 'internal' as const,
      feature_id: null,
      title: 'Panduan Umum MANSATAS App',
      summary: 'Cara memahami dashboard, sidebar, role, fitur aktif, dan pengaturan tampilan.',
      sort_order: 0,
      is_published: 1,
      content_md: [
        '# Panduan Umum MANSATAS App',
        '',
        'MANSATAS App dipakai untuk mengelola administrasi madrasah, akademik, kehadiran, kesiswaan, keuangan, komunikasi, dan layanan orang tua.',
        '',
        '## Navigasi',
        '- Sidebar hanya menampilkan fitur yang aktif untuk role dan user Anda.',
        '- Pada layar HP, beberapa role memiliki navigasi bawah sesuai konfigurasi Super Admin.',
        '- Gunakan profil di sidebar untuk membuka pengaturan akun dan preferensi tampilan.',
        '',
        '## Hak akses',
        '- Akses fitur berasal dari gabungan role, grant khusus user, dan revoke khusus user.',
        '- Jika sebuah fitur tidak terlihat, kemungkinan fitur belum diaktifkan untuk role atau user Anda.',
        '- Hak create, update, dan delete dapat berbeda dari hak membaca halaman.',
        '',
        '## Saat mengalami kendala',
        '- Pastikan tahun ajaran, kelas, tanggal, dan filter yang dipilih sudah benar.',
        '- Catat pesan error yang muncul agar admin bisa menelusuri penyebabnya.',
        '- Hubungi Super Admin jika membutuhkan akses fitur tambahan.',
      ].join('\n'),
    },
    ...MENU_ITEMS.filter(item => item.id !== 'portal-ortu').map(buildFeatureArticle),
    ...PARENT_ARTICLES,
  ]
}

export async function ensureDocumentationTables(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS documentation_articles (
      id TEXT PRIMARY KEY,
      audience TEXT NOT NULL DEFAULT 'internal' CHECK(audience IN ('internal', 'parent')),
      feature_id TEXT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content_md TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_documentation_articles_audience_feature
    ON documentation_articles(audience, feature_id, is_published, sort_order)
  `).run()
}

export async function ensureDocumentationSeed(db: D1Database) {
  await ensureDocumentationTables(db)
  const seeds = getSeedArticles()
  await db.batch(seeds.map(article =>
    db.prepare(`
      INSERT OR IGNORE INTO documentation_articles
        (id, audience, feature_id, title, summary, content_md, sort_order, is_published, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      article.id,
      article.audience,
      article.feature_id,
      article.title,
      article.summary,
      article.content_md,
      article.sort_order,
      article.is_published,
    )
  ))
}

export async function getDocumentationArticles(db: D1Database, options: {
  audience: DocumentationAudience
  allowedFeatures?: string[]
  includeUnpublished?: boolean
}) {
  await ensureDocumentationSeed(db)

  const rows = await db.prepare(`
    SELECT id, audience, feature_id, title, summary, content_md, sort_order, is_published, updated_at
    FROM documentation_articles
    WHERE audience = ?
    ORDER BY sort_order ASC, title ASC
  `).bind(options.audience).all<DocumentationArticle>()

  const allowedSet = new Set(options.allowedFeatures ?? [])
  return (rows.results ?? []).filter(article => {
    if (!options.includeUnpublished && article.is_published !== 1) return false
    if (options.audience === 'parent') return true
    return !article.feature_id || allowedSet.has(article.feature_id)
  })
}

export async function getAllDocumentationArticles(db: D1Database) {
  await ensureDocumentationSeed(db)
  const rows = await db.prepare(`
    SELECT id, audience, feature_id, title, summary, content_md, sort_order, is_published, updated_at
    FROM documentation_articles
    ORDER BY audience ASC, sort_order ASC, title ASC
  `).all<DocumentationArticle>()
  return rows.results ?? []
}

export async function upsertDocumentationArticle(db: D1Database, input: DocumentationInput) {
  await ensureDocumentationTables(db)
  const id = input.id || crypto.randomUUID()
  await db.prepare(`
    INSERT INTO documentation_articles
      (id, audience, feature_id, title, summary, content_md, sort_order, is_published, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      audience = excluded.audience,
      feature_id = excluded.feature_id,
      title = excluded.title,
      summary = excluded.summary,
      content_md = excluded.content_md,
      sort_order = excluded.sort_order,
      is_published = excluded.is_published,
      updated_at = datetime('now')
  `).bind(
    id,
    input.audience,
    input.featureId || null,
    input.title.trim(),
    input.summary.trim(),
    input.contentMd.trim(),
    Number(input.sortOrder || 0),
    input.isPublished ? 1 : 0,
  ).run()
  return id
}
