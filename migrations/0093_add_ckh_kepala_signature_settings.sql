-- CKH Kepala Madrasah signature placement settings
ALTER TABLE ckh_documents ADD COLUMN kepala_signature_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ckh_documents ADD COLUMN kepala_signature_x_mm REAL NOT NULL DEFAULT 14;
ALTER TABLE ckh_documents ADD COLUMN kepala_signature_y_mm REAL NOT NULL DEFAULT 12;
ALTER TABLE ckh_documents ADD COLUMN kepala_signature_width_mm REAL NOT NULL DEFAULT 38;
