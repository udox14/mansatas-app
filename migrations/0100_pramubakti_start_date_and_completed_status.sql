-- Pramubakti mulai dinilai sejak 9 September 2026 dan tidak memiliki status terlambat.
-- Riwayat sebelum tanggal mulai tidak membentuk kewajiban karena buildPbItems
-- selalu membatasi slot berdasarkan pb_members.start_date.
UPDATE pb_members
SET start_date = '2026-09-09'
WHERE start_date < '2026-09-09';

-- Pertahankan bukti lama, tetapi selaraskan statusnya dengan kebijakan "Selesai".
UPDATE pb_reports
SET status = 'TEPAT_WAKTU', revision = revision + 1
WHERE status = 'TELAT';
