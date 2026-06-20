-- Sumber/bank tujuan transfer yang dipilih orang tua saat upload bukti (snapshot label).
-- Ditampilkan ke admin/bendahara saat pengecekan bukti transfer di menu DSPT.
ALTER TABLE fin_payment_submissions ADD COLUMN bank_tujuan TEXT;
