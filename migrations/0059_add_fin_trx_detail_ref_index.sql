-- Index untuk subquery metode_bayar di getDsptList (app/dashboard/keuangan/actions.ts)
-- Tanpa index ini, subquery WHERE ref_type='dspt' AND ref_id=? full-scan
-- fin_transaksi_detail per baris siswa → ratusan juta ROW READ/hari di D1.
CREATE INDEX IF NOT EXISTS idx_fin_trx_detail_ref
  ON fin_transaksi_detail(ref_type, ref_id);
