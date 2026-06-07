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

function buildFeatureArticle(feature: typeof MENU_ITEMS[number], index: number): Omit<DocumentationArticle, 'updated_at'> {
  return {
    id: `feature-${feature.id}`,
    audience: 'internal',
    feature_id: feature.id,
    title: `Panduan ${feature.title}`,
    summary: `Referensi penggunaan fitur ${feature.title} di MANSATAS App.`,
    sort_order: (index + 1) * 10,
    is_published: 1,
    content_md: [
      `# Panduan ${feature.title}`,
      '',
      `Fitur **${feature.title}** tersedia melalui menu ${feature.href}. Dokumentasi ini menjelaskan tujuan fitur, alur kerja umum, dan hal yang perlu diperhatikan oleh pengguna yang memiliki akses.`,
      '',
      '## Fungsi utama',
      `- Membantu pengguna menjalankan pekerjaan yang berkaitan dengan ${feature.title.toLowerCase()}.`,
      '- Menampilkan data sesuai hak akses, role, dan konfigurasi fitur yang aktif.',
      '- Mendukung proses input, pemeriksaan, monitoring, atau pelaporan sesuai konteks halaman.',
      '',
      '## Alur penggunaan',
      `- Buka menu ${feature.title} dari sidebar atau navigasi bawah jika tersedia.`,
      '- Periksa filter, tahun ajaran, kelas, tanggal, atau pilihan lain sebelum membaca data.',
      '- Gunakan tombol aksi yang tersedia untuk menambah, mengubah, menghapus, mencetak, mengekspor, atau mengirim data jika hak akses mengizinkan.',
      '- Simpan perubahan dan periksa pesan sukses atau error yang muncul di layar.',
      '',
      '## Hak akses dan batasan',
      '- Jika menu tidak muncul, akses fitur mungkin belum aktif untuk role atau user tersebut.',
      '- Beberapa tombol dapat disembunyikan walaupun halaman bisa dibuka, tergantung hak CRUD yang diberikan Super Admin.',
      '- Data yang tampil dapat dibatasi oleh role, kelas binaan, penugasan, atau konteks siswa.',
      '',
      '## Tips operasional',
      '- Pastikan data master terkait sudah lengkap sebelum melakukan input transaksi atau rekap.',
      '- Gunakan pencarian dan filter untuk menghindari salah memilih siswa, kelas, atau periode.',
      '- Jika data terlihat tidak sesuai, refresh halaman dan koordinasikan dengan admin pengelola fitur.',
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
