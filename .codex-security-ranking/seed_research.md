# Seed research: cross-academic-year authorization

## User-supplied vulnerability family

The user observed that a teacher can see students in classes linked only through a previous academic year's teaching assignments after a new academic year is active but before its schedule is populated. The requested sibling audit covers staff/teacher/wali/BK access derived from `penugasan_mengajar`, `kelas_binaan_bk`, `riwayat_kelas`, class membership, schedules, and active-year selection across pages, server actions, exports, and detail endpoints.

## Local source anchors

- `app/dashboard/siswa/page.tsx:100-102`: teacher and BK allowed-class queries omit `tahun_ajaran_id`.
- `app/dashboard/siswa/actions.ts:382-384`: export allowed-class queries omit `tahun_ajaran_id` and the export selects extensive biodata.
- `app/dashboard/siswa/[id]/page.tsx:69`: BK detail authorization omits `tahun_ajaran_id`.
- `app/dashboard/rekap-absensi/actions.ts:140-144`: ordinary teacher allowed-class query omits `tahun_ajaran_id`; the BK sibling immediately above uses the active year.
- `app/dashboard/nilai-harian/actions.ts:160` and `:342`: mutation/read authorization accepts any assignment owned by the teacher without proving it belongs to the active year.
- `app/dashboard/agenda/actions.ts:317-320` and `app/dashboard/kehadiran/actions.ts:374-377`: submitted assignment IDs are resolved without an explicit active-year predicate and require caller/path validation review.

## Sibling inventory

Local searches enumerated 36 production files referring to `penugasan_mengajar`, `kelas_binaan_bk`, or `riwayat_kelas`. Every such file was included in `deep_review_input.jsonl`, including 26 explicit add-backs that were outside the ranked top ten percent. Nearby safe controls using `WHERE ... tahun_ajaran_id = ?` are negative controls, not family-wide suppression.

## External research

No CVE, GHSA, external advisory, release, or package-version identifier was supplied. No internet lookup was required; the authoritative seed is the user-reproduced product behavior and checked-out source.
