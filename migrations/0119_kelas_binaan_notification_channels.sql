-- Preserve enabled state, templates, and existing delivery channels.
-- Add inbox delivery only for events about students/homeroom follow-up.
UPDATE notification_event_settings
SET channels_json = json_insert(channels_json, '$[#]', 'in_app')
WHERE event_key IN (
  'attendance_homeroom_alert', 'homeroom_discipline_violation',
  'homeroom_discipline_sanction', 'homeroom_warning_letter',
  'discipline_parent_clarification_submitted', 'homeroom_discipline_clarification'
)
AND json_valid(channels_json)
AND NOT EXISTS (
  SELECT 1 FROM json_each(CASE WHEN json_valid(channels_json) THEN channels_json ELSE '[]' END)
  WHERE value = 'in_app'
);
