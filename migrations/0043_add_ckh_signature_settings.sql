-- CKH signature image and per-document placement settings
ALTER TABLE "user" ADD COLUMN signature_url TEXT;

ALTER TABLE ckh_documents ADD COLUMN signature_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ckh_documents ADD COLUMN signature_x_mm REAL NOT NULL DEFAULT 14;
ALTER TABLE ckh_documents ADD COLUMN signature_y_mm REAL NOT NULL DEFAULT 12;
ALTER TABLE ckh_documents ADD COLUMN signature_width_mm REAL NOT NULL DEFAULT 38;
