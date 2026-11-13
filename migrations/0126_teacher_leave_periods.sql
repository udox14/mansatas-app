ALTER TABLE "user" ADD COLUMN akun_pengganti_cuti INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agenda_guru ADD COLUMN pengganti_cuti_user_id TEXT REFERENCES "user"(id);

CREATE TABLE cuti_guru (
  id TEXT PRIMARY KEY,
  guru_id TEXT NOT NULL REFERENCES "user"(id),
  mulai TEXT NOT NULL,
  selesai TEXT NOT NULL CHECK (selesai >= mulai),
  catatan TEXT,
  dibatalkan INTEGER NOT NULL DEFAULT 0,
  versi INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_cuti_guru_dates ON cuti_guru(guru_id, mulai, selesai) WHERE dibatalkan = 0;

CREATE TABLE cuti_guru_pengganti (
  id TEXT PRIMARY KEY,
  cuti_id TEXT NOT NULL REFERENCES cuti_guru(id),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  mulai TEXT NOT NULL,
  selesai TEXT NOT NULL
);
CREATE INDEX idx_cuti_pengganti_dates ON cuti_guru_pengganti(user_id, mulai, selesai);
CREATE INDEX idx_cuti_pengganti_cuti ON cuti_guru_pengganti(cuti_id, mulai, selesai);

CREATE TABLE cuti_guru_audit (
  id TEXT PRIMARY KEY,
  cuti_id TEXT NOT NULL REFERENCES cuti_guru(id),
  versi INTEGER NOT NULL,
  actor_id TEXT NOT NULL REFERENCES "user"(id),
  aksi TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cuti_id, versi)
);

CREATE TRIGGER cuti_guru_insert_guard BEFORE INSERT ON cuti_guru WHEN NEW.dibatalkan = 0
BEGIN
  SELECT RAISE(ABORT, 'CUTI_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM cuti_guru c WHERE c.guru_id = NEW.guru_id AND c.dibatalkan = 0
    AND c.mulai <= NEW.selesai AND c.selesai >= NEW.mulai
  );
  SELECT RAISE(ABORT, 'CUTI_REPLACEMENT_UNAVAILABLE') WHERE EXISTS (
    SELECT 1 FROM cuti_guru_pengganti p JOIN cuti_guru c ON c.id = p.cuti_id AND c.dibatalkan = 0
    WHERE p.user_id = NEW.guru_id AND p.mulai <= NEW.selesai AND p.selesai >= NEW.mulai AND p.selesai >= p.mulai
  );
END;

CREATE TRIGGER cuti_guru_update_guard BEFORE UPDATE ON cuti_guru WHEN NEW.dibatalkan = 0
BEGIN
  SELECT RAISE(ABORT, 'CUTI_OVERLAP') WHERE EXISTS (
    SELECT 1 FROM cuti_guru c WHERE c.id <> NEW.id AND c.guru_id = NEW.guru_id AND c.dibatalkan = 0
    AND c.mulai <= NEW.selesai AND c.selesai >= NEW.mulai
  );
  SELECT RAISE(ABORT, 'CUTI_REPLACEMENT_UNAVAILABLE') WHERE EXISTS (
    SELECT 1 FROM cuti_guru_pengganti p JOIN cuti_guru c ON c.id = p.cuti_id AND c.dibatalkan = 0
    WHERE p.user_id = NEW.guru_id AND p.mulai <= NEW.selesai AND p.selesai >= NEW.mulai AND p.selesai >= p.mulai
  );
END;

CREATE TRIGGER cuti_guru_pengganti_guard BEFORE INSERT ON cuti_guru_pengganti
BEGIN
  SELECT RAISE(ABORT, 'CUTI_REPLACEMENT_UNAVAILABLE') WHERE NOT EXISTS (
    SELECT 1 FROM cuti_guru c JOIN "user" u ON u.id = NEW.user_id AND COALESCE(u.banned, 0) = 0
    WHERE c.id = NEW.cuti_id AND c.dibatalkan = 0 AND c.guru_id <> NEW.user_id
    AND NEW.mulai >= c.mulai AND NEW.selesai <= c.selesai AND NEW.mulai <= NEW.selesai
  ) OR EXISTS (
    SELECT 1 FROM cuti_guru c WHERE c.guru_id = NEW.user_id AND c.dibatalkan = 0
    AND c.mulai <= NEW.selesai AND c.selesai >= NEW.mulai
  );
END;
