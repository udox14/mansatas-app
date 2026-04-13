# Task: Fitur Isi Agenda Guru Piket (Integrasi ke Agenda Guru Existing)

## Status: 🚀 In Progress

### Plan Approved: Integrate ke agenda_guru via new `penugasan_piket` table

**TODO Steps:**

### 1. ✅ DB Schema [PENDING]
   - [✅] Create migration: `migrations/schema-migration-agenda-piket.sql`
     - CREATE TABLE penugasan_piket (id TEXT PRIMARY KEY, ...)
     - ALTER TABLE agenda_guru ADD COLUMN penugasan_piket_id TEXT
   - [ ] Run migration via app/api/migrate/route.ts

### 2. Backend Actions [PENDING]
   - [✅] `app/dashboard/jadwal-piket/actions.ts`: Add `getPiketToday(userId)`
   - [✅] `app/dashboard/agenda/actions.ts`: 
     - Extend `getJadwalGuruHariIni` for piket blocks
     - Add `submitAgendaPiket(formData)`
   - [ ] Extend monitoring-agenda queries

### 3. Frontend Components [PENDING]
   - [ ] Create `components/dashboard/shared/JadwalPiketToday.tsx` (copy pattern JadwalMengajarToday)
   - [ ] Update `components/dashboard/GuruPiketDashboard.tsx`: Add JadwalPiketToday + "Isi Agenda" modal

### 4. Pages/UI [PENDING]
   - [ ] `app/dashboard/agenda/page.tsx`: Add piket tab/section
   - [ ] `app/dashboard/monitoring-agenda/`: Show piket agendas

### 5. Notifications [PENDING]
   - [ ] Extend `app/api/cron/reminder-jadwal/` for piket shifts

### 6. Testing [PENDING]
   - [ ] Test: Isi agenda piket → check monitoring
   - [ ] Test: Time validation shift, photo upload
   - [ ] Test: Web-push reminder

**Next Step:** Create DB migration
