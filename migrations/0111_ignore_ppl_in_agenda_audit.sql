-- Hapus alert kejanggalan akses agenda antara Guru Mapel dan Guru PPL
-- Relasi kolaborasi Guru Mapel dan Guru PPL adalah hal sah di sekolah (misal satu perangkat dipakai bersama)

DELETE FROM agenda_access_alerts
WHERE EXISTS (
  SELECT 1 FROM guru_ppl_mapping gpm
  WHERE (gpm.guru_ppl_id = agenda_access_alerts.user_a_id AND gpm.guru_utama_id = agenda_access_alerts.user_b_id)
     OR (gpm.guru_ppl_id = agenda_access_alerts.user_b_id AND gpm.guru_utama_id = agenda_access_alerts.user_a_id)
)
OR (
  user_a_id IN (
    SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.role = 'guru_ppl' OR ur.role = 'guru_ppl'
  )
  AND
  user_b_id IN (
    SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN penugasan_mengajar pm ON pm.guru_id = u.id
    LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_utama_id = u.id
    WHERE (u.role IN ('guru', 'guru_mapel', 'wali_kelas', 'guru_piket', 'guru_bk')
           OR ur.role IN ('guru', 'guru_mapel')
           OR pm.id IS NOT NULL OR gpm.id IS NOT NULL)
      AND u.role <> 'guru_ppl'
      AND (ur.role IS NULL OR ur.role <> 'guru_ppl')
  )
)
OR (
  user_b_id IN (
    SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.role = 'guru_ppl' OR ur.role = 'guru_ppl'
  )
  AND
  user_a_id IN (
    SELECT u.id FROM "user" u LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN penugasan_mengajar pm ON pm.guru_id = u.id
    LEFT JOIN guru_ppl_mapping gpm ON gpm.guru_utama_id = u.id
    WHERE (u.role IN ('guru', 'guru_mapel', 'wali_kelas', 'guru_piket', 'guru_bk')
           OR ur.role IN ('guru', 'guru_mapel')
           OR pm.id IS NOT NULL OR gpm.id IS NOT NULL)
      AND u.role <> 'guru_ppl'
      AND (ur.role IS NULL OR ur.role <> 'guru_ppl')
);

-- Eskalasi indikasi historis yang terbukti diikuti pengisian agenda kelas menjadi Risiko TINGGI (skor 100)
UPDATE agenda_access_alerts
SET risk_score = 100, risk_level = 'high', updated_at = datetime('now')
WHERE source = 'historical' AND agenda_id IS NOT NULL AND risk_level = 'medium';
