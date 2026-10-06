-- Explicitly authorized on 2026-10-06: finalize only SPB 014 and 015 using
-- existing treasurer/chairman approvals. Requires final_approval_stage column.
-- No review records, amounts, payment details or disbursements are modified.
-- The single UPDATE and its audit inserts are atomic, even if audit insert fails.
CREATE TRIGGER IF NOT EXISTS komite_finalize_014_015_audit
AFTER UPDATE OF status ON komite_pengajuan
WHEN OLD.status='menunggu_kepala' AND NEW.status='disetujui'
  AND NEW.final_approval_stage='ketua'
  AND OLD.id IN ('5d31b07c-c924-4c18-88e8-eb67b64ffe64','fe4af388-9c20-4e96-a7d3-ea6846c5fda6')
BEGIN
  INSERT INTO activity_logs
    (id,actor_name,actor_roles,module,action,severity,summary,entity_type,entity_id,entity_label,before_json,after_json,metadata_json)
  VALUES (
    lower(hex(randomblob(16))), 'Codex (eksekusi permintaan pengguna)', '[]', 'komite_pengajuan',
    'finalize_after_chairman_by_committee_request', 'info',
    'Menerbitkan SPB berdasarkan persetujuan Ketua yang sudah tercatat, atas permintaan Komite melalui pengguna tanggal 6 Oktober 2026.',
    'komite_pengajuan', NEW.id, NEW.judul,
    json_object('status',OLD.status,'approved_at',OLD.approved_at,'final_approval_stage',OLD.final_approval_stage,
      'updated_at',OLD.updated_at,'nomor_spb',OLD.nomor_spb,'nominal',OLD.nominal,'current_version',OLD.current_version),
    json_object('status',NEW.status,'approved_at',NEW.approved_at,'final_approval_stage',NEW.final_approval_stage,
      'updated_at',NEW.updated_at,'nomor_spb',NEW.nomor_spb,'nominal',NEW.nominal,'current_version',NEW.current_version),
    json_object('authorization','Permintaan eksplisit Komite melalui pengguna dalam percakapan Codex, 2026-10-06',
      'reason','Tahap Kepala tidak diperlukan untuk kedua pengajuan ini; Ketua telah menyetujui.',
      'existing_chairman_review_id',(SELECT id FROM komite_pengajuan_reviews WHERE pengajuan_id=NEW.id AND version_number=NEW.current_version AND stage='ketua' AND action='setujui'),
      'existing_chairman_approved_at',(SELECT created_at FROM komite_pengajuan_reviews WHERE pengajuan_id=NEW.id AND version_number=NEW.current_version AND stage='ketua' AND action='setujui'),
      'principal_approval_created',json('false'),'financial_amount_changed',json('false'))
  );
END;

WITH eligible AS MATERIALIZED (
  SELECT p.id FROM komite_pengajuan p
  WHERE p.status='menunggu_kepala' AND p.current_version=1
    AND p.approved_at IS NULL AND p.final_approval_stage IS NULL
    AND p.realisasi_status='belum' AND p.nomor_spb IS NOT NULL
    AND ((p.id='5d31b07c-c924-4c18-88e8-eb67b64ffe64' AND p.nomor_spb='SPB / 014 / KOMITE / X / 2026' AND p.nominal=9950000 AND p.updated_at='2026-10-03 03:54:07')
      OR (p.id='fe4af388-9c20-4e96-a7d3-ea6846c5fda6' AND p.nomor_spb='SPB / 015 / KOMITE / X / 2026' AND p.nominal=5220000 AND p.updated_at='2026-10-03 04:04:19'))
    AND EXISTS (SELECT 1 FROM komite_pengajuan_reviews r WHERE r.pengajuan_id=p.id AND r.version_number=p.current_version AND r.stage='bendahara' AND r.action='setujui')
    AND EXISTS (SELECT 1 FROM komite_pengajuan_reviews r WHERE r.pengajuan_id=p.id AND r.version_number=p.current_version AND r.stage='ketua' AND r.action='setujui')
    AND NOT EXISTS (SELECT 1 FROM komite_pengajuan_reviews r WHERE r.pengajuan_id=p.id AND r.version_number=p.current_version AND r.stage='kepala')
    AND (SELECT SUM(jumlah) FROM komite_pengajuan_rincian d WHERE d.pengajuan_id=p.id)=p.nominal
)
UPDATE komite_pengajuan SET status='disetujui',final_approval_stage='ketua',
  approved_at=datetime('now'),updated_at=datetime('now')
WHERE id IN (SELECT id FROM eligible) AND (SELECT COUNT(*) FROM eligible)=2;

DROP TRIGGER komite_finalize_014_015_audit;
