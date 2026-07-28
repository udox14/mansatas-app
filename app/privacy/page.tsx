import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPageShell, LegalSection } from '@/components/legal/legal-page-shell'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi | MANSATAS App',
  description: 'Kebijakan privasi dan pengelolaan data pengguna MANSATAS App.',
}

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Kebijakan Privasi"
      description="Dokumen ini menjelaskan data yang diproses oleh MANSATAS App, alasan pemrosesan, cara data dilindungi, serta pilihan yang tersedia bagi pengguna."
      updatedAt="28 Juli 2026"
    >
      <LegalSection title="1. Pengelola aplikasi">
        <p>
          MANSATAS App adalah sistem informasi layanan madrasah yang dikelola oleh MAN 1
          Tasikmalaya. Aplikasi digunakan untuk mendukung kegiatan administrasi, akademik,
          kesiswaan, kehadiran, komunikasi dengan orang tua/wali, pengelolaan dokumen, dan
          layanan internal madrasah.
        </p>
      </LegalSection>

      <LegalSection title="2. Data yang diproses">
        <p>Jenis data bergantung pada peran dan fitur yang digunakan, dan dapat meliputi:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>identitas pengguna, pegawai, siswa, dan orang tua/wali;</li>
          <li>alamat email, nomor telepon/WhatsApp, serta informasi akun dan peran;</li>
          <li>data akademik, kelas, jadwal, nilai, kehadiran, kegiatan, dan kedisiplinan;</li>
          <li>foto, tanda tangan, dokumen PDF/Office, serta berkas yang dipilih pengguna;</li>
          <li>informasi komunikasi, saran, pengumuman, dan respons orang tua/wali;</li>
          <li>informasi administrasi keuangan madrasah dan bukti yang dikirim pengguna;</li>
          <li>
            informasi teknis seperti alamat IP, jenis perangkat/browser, catatan aktivitas,
            token notifikasi, dan status jaringan;
          </li>
          <li>
            kamera atau lokasi perangkat hanya ketika pengguna secara sadar menjalankan fitur
            yang membutuhkannya dan memberikan izin sistem.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Tujuan penggunaan data">
        <p>
          Data digunakan untuk menyediakan layanan madrasah, autentikasi dan pengaturan hak
          akses, pencatatan kegiatan akademik/administratif, komunikasi resmi, pembuatan
          laporan dan dokumen, pengiriman notifikasi, keamanan sistem, audit, pencegahan
          penyalahgunaan, serta pemenuhan kewajiban penyelenggaraan pendidikan.
        </p>
      </LegalSection>

      <LegalSection title="4. Dasar dan batas pemrosesan">
        <p>
          Akun umumnya disediakan atau diaktifkan oleh madrasah sesuai hubungan pengguna
          dengan MAN 1 Tasikmalaya. Pengguna hanya boleh mengakses data sesuai tugas, peran,
          dan kewenangannya. Aplikasi tidak menjual data pribadi dan tidak menggunakan data
          pengguna untuk periklanan bertarget.
        </p>
      </LegalSection>

      <LegalSection title="5. Penyimpanan dan pihak penyedia layanan">
        <p>
          Data dapat diproses pada infrastruktur yang digunakan MAN 1 Tasikmalaya, termasuk
          layanan hosting, basis data, penyimpanan berkas, pengiriman notifikasi, dan layanan
          komunikasi. Penyedia tersebut digunakan sebatas untuk menjalankan fungsi aplikasi
          dan tunduk pada pengaturan keamanan serta ketentuan layanan masing-masing.
        </p>
      </LegalSection>

      <LegalSection title="6. Keamanan data">
        <p>
          Koneksi produksi menggunakan HTTPS. Akses dibatasi melalui autentikasi, sesi, peran,
          dan izin fitur. Kami menerapkan pencatatan aktivitas serta pembatasan akses sesuai
          kebutuhan. Walaupun perlindungan yang wajar diterapkan, tidak ada sistem elektronik
          yang dapat menjamin keamanan mutlak.
        </p>
      </LegalSection>

      <LegalSection title="7. Retensi dan penghapusan">
        <p>
          Data disimpan selama diperlukan untuk layanan pendidikan, administrasi, audit, dan
          kewajiban hukum/kelembagaan. Sebagian data akademik atau arsip resmi mungkin perlu
          dipertahankan meskipun akun dinonaktifkan. Untuk meminta peninjauan, koreksi, atau
          penghapusan data yang memenuhi syarat, gunakan halaman{' '}
          <Link href="/data-deletion" className="font-semibold text-teal-700 underline">
            Permintaan Penghapusan Data
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="8. Notifikasi dan izin perangkat">
        <p>
          Pengguna dapat menolak atau menonaktifkan notifikasi, kamera, dan izin perangkat
          melalui pengaturan Android. Penolakan izin hanya memengaruhi fitur yang memerlukan
          izin tersebut. Token notifikasi dapat dihapus ketika pengguna keluar atau meminta
          penghentian notifikasi.
        </p>
      </LegalSection>

      <LegalSection title="9. Pengguna usia sekolah">
        <p>
          Aplikasi dapat memproses data siswa sebagai bagian dari penyelenggaraan layanan
          pendidikan. Akses siswa/orang tua dibatasi pada portal dan informasi yang relevan.
          Orang tua/wali dapat menghubungi madrasah untuk pertanyaan atau permintaan mengenai
          data siswa yang berada dalam tanggung jawabnya.
        </p>
      </LegalSection>

      <LegalSection title="10. Perubahan kebijakan">
        <p>
          Kebijakan ini dapat diperbarui untuk menyesuaikan fitur, praktik keamanan, atau
          ketentuan yang berlaku. Tanggal pembaruan terbaru dicantumkan di bagian atas halaman.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
