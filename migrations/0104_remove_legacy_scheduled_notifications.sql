-- Modul jadwal broadcast lama sudah tidak digunakan. Notifikasi otomatis
-- diproses dari notification_event_settings oleh cron reminder-jadwal.
DROP TABLE IF EXISTS jadwal_notifikasi;

DELETE FROM system_settings
WHERE key = 'cron_reminder_jadwal_enabled';

DELETE FROM role_feature_permissions
WHERE feature_id = 'settings-jadwal-notif';

DELETE FROM role_features
WHERE feature_id = 'settings-jadwal-notif';

DELETE FROM user_feature_overrides
WHERE feature_id = 'settings-jadwal-notif';

DELETE FROM feature_display_settings
WHERE feature_id = 'settings-jadwal-notif';

-- Bersihkan field sakelar reminder ganda. Status event pada kolom enabled
-- menjadi satu-satunya sumber kebenaran; nilai waktu lainnya tetap disimpan.
UPDATE notification_event_settings
SET reminder_json = json_set(reminder_json, '$.enabled', json('true'))
WHERE event_key IN (
  'attendance_missing_reminder',
  'meeting_reminder',
  'task_pending_reminder',
  'pramubakti_slot_reminder',
  'kbm_teaching_reminder'
)
AND json_valid(reminder_json);
