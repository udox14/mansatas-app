-- Mempercepat sumber jadwal untuk cetak agenda per kelas/periode.
CREATE INDEX IF NOT EXISTS idx_penugasan_ta_kelas
  ON penugasan_mengajar(tahun_ajaran_id, kelas_id);

CREATE INDEX IF NOT EXISTS idx_jadwal_ta_hari_penugasan_jam
  ON jadwal_mengajar(tahun_ajaran_id, hari, penugasan_id, jam_ke);
