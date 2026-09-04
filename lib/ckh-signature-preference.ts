// Keep document flags in sync so monitoring and every print format use the same preference.
export const CKH_SIGNATURE_PREFERENCE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ckh_signature_preferences (
    user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1))
  )`,
  `UPDATE ckh_documents
   SET signature_enabled = COALESCE((
     SELECT enabled FROM ckh_signature_preferences WHERE user_id = ckh_documents.user_id
   ), 1)
   WHERE signature_enabled <> COALESCE((
     SELECT enabled FROM ckh_signature_preferences WHERE user_id = ckh_documents.user_id
   ), 1)`,
]
