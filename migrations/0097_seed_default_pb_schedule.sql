-- Seed default work slots for Pramubakti (Monday to Saturday, 4 slots each)
-- Slot 1: 06:45 - 08:00
-- Slot 2: 08:00 - 10:00
-- Slot 3: 10:00 - 12:00
-- Slot 4: 12:00 - 15:00
INSERT OR IGNORE INTO pb_schedule_versions (id, effective_date, slots_json, actor_id)
VALUES (
  'default_pb_v1',
  '2026-01-01',
  '[{"id":"pb-slot-1-1","weekday":1,"start":"06:45","end":"08:00"},{"id":"pb-slot-1-2","weekday":1,"start":"08:00","end":"10:00"},{"id":"pb-slot-1-3","weekday":1,"start":"10:00","end":"12:00"},{"id":"pb-slot-1-4","weekday":1,"start":"12:00","end":"15:00"},{"id":"pb-slot-2-1","weekday":2,"start":"06:45","end":"08:00"},{"id":"pb-slot-2-2","weekday":2,"start":"08:00","end":"10:00"},{"id":"pb-slot-2-3","weekday":2,"start":"10:00","end":"12:00"},{"id":"pb-slot-2-4","weekday":2,"start":"12:00","end":"15:00"},{"id":"pb-slot-3-1","weekday":3,"start":"06:45","end":"08:00"},{"id":"pb-slot-3-2","weekday":3,"start":"08:00","end":"10:00"},{"id":"pb-slot-3-3","weekday":3,"start":"10:00","end":"12:00"},{"id":"pb-slot-3-4","weekday":3,"start":"12:00","end":"15:00"},{"id":"pb-slot-4-1","weekday":4,"start":"06:45","end":"08:00"},{"id":"pb-slot-4-2","weekday":4,"start":"08:00","end":"10:00"},{"id":"pb-slot-4-3","weekday":4,"start":"10:00","end":"12:00"},{"id":"pb-slot-4-4","weekday":4,"start":"12:00","end":"15:00"},{"id":"pb-slot-5-1","weekday":5,"start":"06:45","end":"08:00"},{"id":"pb-slot-5-2","weekday":5,"start":"08:00","end":"10:00"},{"id":"pb-slot-5-3","weekday":5,"start":"10:00","end":"12:00"},{"id":"pb-slot-5-4","weekday":5,"start":"12:00","end":"15:00"},{"id":"pb-slot-6-1","weekday":6,"start":"06:45","end":"08:00"},{"id":"pb-slot-6-2","weekday":6,"start":"08:00","end":"10:00"},{"id":"pb-slot-6-3","weekday":6,"start":"10:00","end":"12:00"},{"id":"pb-slot-6-4","weekday":6,"start":"12:00","end":"15:00"}]',
  'system'
);
