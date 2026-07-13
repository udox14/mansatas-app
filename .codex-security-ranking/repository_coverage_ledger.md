# Repository coverage ledger (initial frontier)

| Row | Boundary / area | Family | Root/source anchor | Sink/control checked | Disposition | Evidence / next closure |
|---|---|---|---|---|---|---|
| AUTH-STAFF | Staff and role sessions | Authentication/session fixation/bypass | `utils/auth/index.ts`, `utils/auth/server.ts`, auth routes | session creation/consumption and role binding | open | Ranked for full-file review. |
| AUTHZ-YEAR-SISWA-LIST | Teacher/BK to student directory | Cross-year object authorization | `app/dashboard/siswa/page.tsx:100-102` | current class student listing | open_seed | Exact user-reproduced seed. |
| AUTHZ-YEAR-SISWA-EXPORT | Teacher/BK to bulk student biodata | Cross-year object authorization/bulk disclosure | `app/dashboard/siswa/actions.ts:382-384` | export query at `:396+` | open_seed | Exact sibling seed; high field sensitivity. |
| AUTHZ-YEAR-SISWA-DETAIL-BK | BK to student detail | Cross-year object authorization | `app/dashboard/siswa/[id]/page.tsx:69` | full student detail query/render | open_seed | Missing TA predicate. |
| AUTHZ-YEAR-REKAP | Teacher to class attendance recap | Cross-year object authorization | `app/dashboard/rekap-absensi/actions.ts:140-144` | class-filtered attendance/report data | open_seed | Active-year BK negative control at `:130-134`. |
| AUTHZ-YEAR-NILAI | Teacher to daily grades | Cross-year assignment authorization | `app/dashboard/nilai-harian/actions.ts:160`, `:342` | create/update/read grade operations | open_seed | Needs exact active-year binding validation. |
| AUTHZ-YEAR-AGENDA | Teacher to agenda/assignment | Cross-year assignment authorization | `app/dashboard/agenda/actions.ts:317-320` | agenda write/read | open_seed | Needs caller and date/TA trace. |
| AUTHZ-YEAR-KEHADIRAN | Teacher to attendance session | Cross-year assignment authorization | `app/dashboard/kehadiran/actions.ts:374-377` | attendance session and student status writes | open_seed | Needs caller and active TA trace. |
| AUTHZ-PARENT | Parent to child records | BOLA/object isolation | parent portal pages/actions | student/link identifiers and downloads | open | Ranked for review. |
| AUTHZ-ACTIONS | Direct server actions | Missing operation/feature authorization | ranked dashboard action files | mutations, exports, imports | open | UI gating is not sufficient; full-file review in batches. |
| PRIV-MAINT | Migration/cron/webhook routes | Missing auth/secret verification | `app/api/migrate`, cron and webhook routes | privileged DB jobs and external messaging | open | Ranked for review. |
| FILE-MEDIA | Media/download/upload routes | Path traversal/arbitrary file access | media and download routes, R2 helpers | object key selection/read/write/delete | open | Ranked for review. |
| INJECTION-D1 | Public/staff DB operations | SQL/query injection | action and route parameters | D1 `prepare` calls, dynamic identifiers | open | Parameterized queries expected; verify dynamic fragments. |
| IMPORT-PARSER | Academic and spreadsheet imports | Unsafe parsing/mass assignment/integrity | `lib/academic-import.ts`, academic actions | XLSX/XML-derived rows to D1 | open | Check structural validation and year isolation. |
| SSRF-CALLBACK | Webhooks/notifications/media | SSRF/callback abuse | webhook and notification configuration | fetch/outbound destination | open | Review each outbound destination source/control. |
| XSS-RENDER | Stored school data to HTML/documents | Stored XSS/template injection | rendered client content and generated HTML | `dangerouslySetInnerHTML`, string templates | open | Frontier searches and selected file reviews. |
| SECRETS-CONFIG | Runtime configuration | Secret exposure/default credentials | auth/config/cron integration code | client bundles, logs, weak defaults | open | Secondary after high-impact boundaries. |
