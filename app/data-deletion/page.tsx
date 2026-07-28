import type { Metadata } from 'next'
import { LegalPageShell, LegalSection } from '@/components/legal/legal-page-shell'

export const metadata: Metadata = {
  title: 'Penghapusan Data | MANSATAS App',
  description: 'Cara meminta penonaktifan akun dan penghapusan data MANSATAS App.',
}

const requestSubject = encodeURIComponent('Permintaan Penghapusan Data MANSATAS App')
const requestBody = encodeURIComponent(
  [
    'Yth. Admin MANSATAS App,',
    '',
    'Saya mengajukan permintaan terkait akun/data berikut:',
    'Nama lengkap:',
    'Peran (pegawai/orang tua/wali):',
    'Email atau NISN akun:',
    'Jenis permintaan (penonaktifan akun/koreksi/penghapusan data):',
    'Keterangan:',
    '',
    'Saya bersedia melakukan verifikasi identitas/kewenangan sesuai prosedur madrasah.',
  ].join('\n'),
)

export default function DataDeletionPage() {
  return (
    <LegalPageShell
      title="Permintaan Penghapusan Data"
      description="Pengguna dapat meminta penonaktifan akun, koreksi, atau penghapusan data yang memenuhi syarat melalui prosedur resmi MAN 1 Tasikmalaya."
      updatedAt="28 Juli 2026"
    >
      <LegalSection title="Cara mengajukan permintaan">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Kirim email dari alamat yang dapat diverifikasi ke{' '}
            <a
              href={`mailto:admin@man1tasikmalaya.sch.id?subject=${requestSubject}&body=${requestBody}`}
              className="font-semibold text-teal-700 underline"
            >
              admin@man1tasikmalaya.sch.id
            </a>
            .
          </li>
          <li>
            Cantumkan nama, peran, email/NISN akun, jenis permintaan, dan penjelasan singkat.
          </li>
          <li>
            Admin dapat meminta verifikasi identitas atau kewenangan sebagai orang tua/wali
            untuk mencegah penghapusan oleh pihak yang tidak berhak.
          </li>
          <li>
            Setelah diverifikasi, madrasah akan menginformasikan hasil dan tindakan yang dapat
            dilakukan.
          </li>
        </ol>
        <a
          href={`mailto:admin@man1tasikmalaya.sch.id?subject=${requestSubject}&body=${requestBody}`}
          className="mt-5 inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
        >
          Buat Email Permintaan
        </a>
      </LegalSection>

      <LegalSection title="Data yang dapat dihapus atau dinonaktifkan">
        <p>
          Sesuai hasil verifikasi dan kewajiban madrasah, tindakan dapat berupa penonaktifan
          akun, penghapusan sesi dan token notifikasi, penghapusan data profil yang tidak lagi
          diperlukan, koreksi data, atau anonimisasi data tertentu.
        </p>
      </LegalSection>

      <LegalSection title="Data yang mungkin perlu dipertahankan">
        <p>
          Arsip akademik, kehadiran, administrasi, transaksi, surat, catatan audit, atau data
          lain yang diwajibkan oleh peraturan dan kepentingan penyelenggaraan pendidikan dapat
          dipertahankan selama masa retensi yang berlaku. Jika data tidak dapat dihapus,
          madrasah akan menjelaskan alasan dan, bila memungkinkan, membatasi akses atau
          melakukan anonimisasi.
        </p>
      </LegalSection>

      <LegalSection title="Perkiraan penanganan">
        <p>
          Permintaan akan ditinjau setelah identitas dan kewenangan pemohon terverifikasi.
          Waktu penyelesaian bergantung pada jenis data, kebutuhan koordinasi, serta kewajiban
          retensi yang berlaku.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
