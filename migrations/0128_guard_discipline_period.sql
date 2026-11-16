-- Guard new records and changes to date/semester. Keep historical rows available for audit.
CREATE TRIGGER IF NOT EXISTS siswa_pelanggaran_validate_period_insert
BEFORE INSERT ON siswa_pelanggaran
FOR EACH ROW WHEN
  NOT EXISTS (
    SELECT 1
    FROM (
      SELECT semester, replace(nama, ' ', '') AS nama
      FROM tahun_ajaran
      WHERE id = NEW.tahun_ajaran_id
    ) AS periode
    WHERE NEW.tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND date(NEW.tanggal, '+0 days') = NEW.tanggal
      AND (
        (periode.semester = 1 AND NEW.tanggal BETWEEN
          substr(periode.nama, instr(periode.nama, '/') - 4, 4) || '-07-01' AND
          substr(periode.nama, instr(periode.nama, '/') - 4, 4) || '-12-31')
        OR
        (periode.semester = 2 AND NEW.tanggal BETWEEN
          substr(periode.nama, instr(periode.nama, '/') + 1, 4) || '-01-01' AND
          substr(periode.nama, instr(periode.nama, '/') + 1, 4) || '-06-30')
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'Tanggal pelanggaran tidak cocok dengan tahun ajaran dan semester.');
END;

CREATE TRIGGER IF NOT EXISTS siswa_pelanggaran_validate_period_update
BEFORE UPDATE OF tanggal, tahun_ajaran_id ON siswa_pelanggaran
FOR EACH ROW WHEN
  (NEW.tanggal IS NOT OLD.tanggal OR NEW.tahun_ajaran_id IS NOT OLD.tahun_ajaran_id)
  AND
  NOT EXISTS (
    SELECT 1
    FROM (
      SELECT semester, replace(nama, ' ', '') AS nama
      FROM tahun_ajaran
      WHERE id = NEW.tahun_ajaran_id
    ) AS periode
    WHERE NEW.tanggal GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND date(NEW.tanggal, '+0 days') = NEW.tanggal
      AND (
        (periode.semester = 1 AND NEW.tanggal BETWEEN
          substr(periode.nama, instr(periode.nama, '/') - 4, 4) || '-07-01' AND
          substr(periode.nama, instr(periode.nama, '/') - 4, 4) || '-12-31')
        OR
        (periode.semester = 2 AND NEW.tanggal BETWEEN
          substr(periode.nama, instr(periode.nama, '/') + 1, 4) || '-01-01' AND
          substr(periode.nama, instr(periode.nama, '/') + 1, 4) || '-06-30')
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'Tanggal pelanggaran tidak cocok dengan tahun ajaran dan semester.');
END;
