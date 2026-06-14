-- Migration: Ekstrakurikuler
-- Modul ekstrakurikuler berdiri sendiri (TIDAK menempel jadwal_mengajar/penugasan_mengajar).
-- Pembina membuat pertemuan (latihan) ad-hoc; tidak ada jadwal fixed.
-- Kontinuitas TA: master ekskul & keanggotaan PERSIST lintas tahun ajaran;
-- pertemuan & nilai diikat tahun_ajaran_id (= semester) untuk rekap per semester.

-- 1. Master ekskul (berkelanjutan, tanpa tahun_ajaran_id)
CREATE TABLE IF NOT EXISTS ekstrakurikuler (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  nama            TEXT NOT NULL,
  deskripsi       TEXT,
  mode_nilai      TEXT NOT NULL DEFAULT 'angka' CHECK(mode_nilai IN ('angka','huruf')),
  status          TEXT NOT NULL DEFAULT 'aktif',  -- 'aktif'|'nonaktif'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Pembina (banyak guru per ekskul)
CREATE TABLE IF NOT EXISTS ekstrakurikuler_pembina (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ekstrakurikuler_id TEXT NOT NULL REFERENCES ekstrakurikuler(id) ON DELETE CASCADE,
  pembina_id         TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  UNIQUE(ekstrakurikuler_id, pembina_id)
);

-- 3. Anggota siswa (siswa boleh >1 ekskul). PERSIST lintas TA (tanpa tahun_ajaran_id)
CREATE TABLE IF NOT EXISTS ekstrakurikuler_anggota (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ekstrakurikuler_id TEXT NOT NULL REFERENCES ekstrakurikuler(id) ON DELETE CASCADE,
  siswa_id           TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'aktif',  -- 'aktif'|'keluar'
  joined_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ekstrakurikuler_id, siswa_id)
);

-- 4. Pertemuan/latihan = presensi pembina (1 baris = 1 latihan). Diikat TA (semester) aktif
CREATE TABLE IF NOT EXISTS ekstrakurikuler_pertemuan (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ekstrakurikuler_id TEXT NOT NULL REFERENCES ekstrakurikuler(id) ON DELETE CASCADE,
  tahun_ajaran_id    TEXT REFERENCES tahun_ajaran(id) ON DELETE SET NULL,
  tanggal            TEXT NOT NULL,        -- YYYY-MM-DD
  judul              TEXT,                 -- judul/materi latihan
  catatan            TEXT,
  foto_url           TEXT,
  status_pembina     TEXT NOT NULL DEFAULT 'HADIR',
  diinput_oleh       TEXT NOT NULL REFERENCES "user"(id),  -- audit (real admin/pembina)
  pembina_id         TEXT REFERENCES "user"(id),           -- pembina efektif pertemuan ini
  waktu_input        TEXT NOT NULL DEFAULT (datetime('now')),
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Absensi siswa per pertemuan (sparse: hanya non-HADIR)
CREATE TABLE IF NOT EXISTS ekstrakurikuler_absensi (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  pertemuan_id TEXT NOT NULL REFERENCES ekstrakurikuler_pertemuan(id) ON DELETE CASCADE,
  siswa_id     TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK(status IN ('SAKIT','IZIN','ALFA')),
  catatan      TEXT,
  UNIQUE(pertemuan_id, siswa_id)
);

-- 6. Nilai per siswa per ekskul PER SEMESTER (nilai TEXT: "85" atau "A", divalidasi by mode di action)
CREATE TABLE IF NOT EXISTS ekstrakurikuler_nilai (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ekstrakurikuler_id TEXT NOT NULL REFERENCES ekstrakurikuler(id) ON DELETE CASCADE,
  siswa_id           TEXT NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
  tahun_ajaran_id    TEXT NOT NULL REFERENCES tahun_ajaran(id) ON DELETE CASCADE,  -- = semester
  nilai              TEXT,
  catatan            TEXT,
  dinilai_oleh       TEXT REFERENCES "user"(id),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ekstrakurikuler_id, siswa_id, tahun_ajaran_id)
);

CREATE INDEX IF NOT EXISTS idx_ekskul_pembina_ek   ON ekstrakurikuler_pembina(ekstrakurikuler_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_pembina_user ON ekstrakurikuler_pembina(pembina_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_anggota_ek   ON ekstrakurikuler_anggota(ekstrakurikuler_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_anggota_sw   ON ekstrakurikuler_anggota(siswa_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_pertemuan_ek ON ekstrakurikuler_pertemuan(ekstrakurikuler_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_ekskul_absensi_pt   ON ekstrakurikuler_absensi(pertemuan_id);
CREATE INDEX IF NOT EXISTS idx_ekskul_nilai_ek     ON ekstrakurikuler_nilai(ekstrakurikuler_id, tahun_ajaran_id);
