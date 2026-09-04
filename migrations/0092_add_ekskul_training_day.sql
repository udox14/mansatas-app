-- WITHDRAWN: the former rebuild caused ON DELETE CASCADE data loss.
-- defer_foreign_keys does NOT disable cascading deletes in D1/SQLite.
-- Never rerun the old DROP TABLE migration. Existing non-STRICT INTEGER
-- columns can store the JSON arrays used by the application.
-- This marker performs no schema or data changes.
SELECT 1;
