# Overview

MANSATAS is the integrated ERP for MAN 1 Tasikmalaya. Its primary runtime is a Next.js 16 application deployed through OpenNext on Cloudflare Workers, backed by Cloudflare D1 for relational school data and R2 for uploaded media. It serves staff, teachers, school leadership, administrative operators, parents, and public admissions users. Core product surfaces cover student identity and class placement, academic assignments and schedules, attendance, grades, discipline and counseling, finance, staff performance documents, notifications, admissions, exports, and parent-facing views.

The repository contains production server components, server actions, and route handlers under `app/`; shared authorization, database, scheduling, notification, document, and audit helpers under `lib/` and `utils/`; schema and migrations under `migrations/`; and a Capacitor Android wrapper. Developer scripts, generated build directories, local logs, and documentation are not primary remote attack surfaces unless their behavior is invoked by production configuration.

# Threat Model, Trust Boundaries, and Assumptions

The most important assets are student and parent PII, academic records, attendance and behavioral records, financial data, staff identity and performance records, uploaded documents and images, account/session credentials, Cloudflare bindings and secrets, and the integrity of active-year academic configuration. Availability matters during daily attendance and operational workflows, but confidentiality and record integrity are the dominant risks.

Principal trust boundaries are:

- Unauthenticated internet clients to public authentication, admissions, webhook, media, cron, migration, and download routes.
- Authenticated parents to records belonging only to their linked children.
- Authenticated staff to role- and feature-controlled application areas.
- Teachers, wali kelas, guru BK, guru piket, leadership, TU, and super administrators to differently privileged subsets of student and operational data.
- One academic year or semester to another. Historical assignments and class membership must remain available for legitimate history while never granting current operational access merely because an old relationship exists.
- Browser-controlled parameters and uploaded files to server actions, route handlers, D1 queries, R2 objects, spreadsheet parsers, PDF/document generation, and notification integrations.
- Application code to Cloudflare D1, R2, KV/cache, push services, WhatsApp/webhook integrations, and any configured secrets.

Authentication uses custom staff and parent sessions exposed through `utils/auth/server.ts`. Role and feature access are resolved in `lib/features.ts`. These controls are assumed to identify the caller correctly; every page, server action, and route handler must still enforce object-level and operation-level authorization at the server boundary. UI visibility or a prior page redirect is not an authorization control for directly invoked server actions.

Attacker-controlled inputs include login credentials, request bodies and query parameters, route identifiers, file uploads and spreadsheet contents, public admissions submissions, webhook payloads, and any identifiers a lower-privileged authenticated user can submit to server actions. Operator-controlled inputs include role/feature assignments, active academic year, class placement, academic imports, schedules, notification configuration, and migration/deployment operations. Developer-controlled inputs include source, migrations, build configuration, and Cloudflare bindings.

Repository-wide security invariants include:

- Every sensitive read or mutation is authenticated and authorized for the caller, role, feature, object, and operation.
- Teacher, wali kelas, and BK access is derived from the intended active or explicitly selected academic period; historical relationships do not silently expand current access.
- Parent access is confined to explicitly linked children, including downloads and indirect identifiers.
- Client-provided user, student, class, assignment, year, and file identifiers are never trusted without server-side ownership or scope checks.
- Privileged administration, migration, cron, webhook, and notification endpoints require strong secrets or roles and fail closed.
- D1 queries remain parameterized and dynamic identifiers are restricted to fixed allowlists.
- R2/media access prevents traversal, arbitrary key access, unsafe content handling, and unauthorized disclosure.
- Imports and bulk operations validate structure, preserve year boundaries, expose errors, and avoid partial or cross-period corruption.
- Secrets, password material, session tokens, and private records are not logged, returned, cached publicly, or embedded in client bundles.
- Audit logs capture sensitive administrative changes without becoming a new PII or secret disclosure surface.

# Attack Surface, Mitigations, and Attacker Stories

The main attack surfaces are Next.js server actions and route handlers, dynamic student and document pages, staff and parent portals, D1-backed search/export/report endpoints, spreadsheet and document import/export, media upload/download through R2, authentication/session endpoints, public admissions, webhooks, cron routes, notifications, and administrative configuration.

Existing mitigations include PBKDF2 password handling and session helpers, role aggregation and feature checks, frequent parameterized D1 statements, role-gated administrative helpers, active-year filters in many schedule and attendance queries, server-side redirects for unauthenticated pages, object-storage validation helpers, and activity logging. These controls are unevenly applied; direct server actions and object-level queries remain the critical enforcement points.

Realistic attacker stories include a normal teacher invoking a server action directly to export students from classes taught in a prior year; a parent changing a student or document identifier to reach another family; a staff member with read-only feature access invoking an unguarded mutation; an unauthenticated caller reaching a weakly protected maintenance or cron endpoint; a user manipulating uploaded file metadata or R2 keys; or an operator importing ambiguous names that bind records to the wrong person, class, or period.

Cross-site scripting, request forgery, injection, insecure direct object references, privilege escalation, mass assignment, unsafe upload/download behavior, weak webhook/cron authentication, and sensitive caching are relevant classes. SQL injection is less likely where fixed SQL and D1 bind parameters are consistently used, but dynamic table, column, ordering, or predicate construction remains security-sensitive. Native Android code is secondary unless it stores long-lived credentials insecurely or bypasses the same server authorization.

Out of scope as remote attacker stories are arbitrary modification of trusted deployment source, Cloudflare account takeover, or a malicious super administrator acting within explicitly granted unrestricted powers. Accidental operator mistakes are still security-relevant when the application silently crosses academic-year, family, or class boundaries.

# Severity Calibration (Critical, High, Medium, Low)

Critical findings enable unauthenticated or broadly authenticated compromise of all accounts, unrestricted database/R2 access, secret extraction, arbitrary privileged code or migration execution, or systemic alteration/deletion of school records.

High findings expose or modify large sets of student, parent, financial, academic, or behavioral records across roles, families, or academic periods; allow privilege escalation to administrator capabilities; bypass authentication on sensitive maintenance/export endpoints; or enable persistent stored script execution in privileged staff sessions.

Medium findings disclose a bounded but sensitive set of records to an authenticated role lacking a current relationship, permit unauthorized changes with limited blast radius, expose individual private files through predictable identifiers, or weaken workflow integrity without systemic compromise. Cross-academic-year teacher access to current student PII is typically medium and can become high when bulk export or highly sensitive fields are reachable.

Low findings expose limited non-sensitive metadata, permit minor workflow interference, lack a realistic attacker-controlled entry point, or require a trusted operator to make an obvious configuration mistake with small impact. Defense-in-depth inconsistencies without a reachable sensitive source-to-sink path should not be promoted above low or informational status.

Repository: target_sha256_474750afb7698eb83c41f74e39201f3956326d2298763147cedeb23dcadcd672
Version: 5c6dc275def170dd75f3d9e69be356e48ca21f04
