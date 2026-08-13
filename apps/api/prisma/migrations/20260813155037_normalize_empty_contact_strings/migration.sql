-- Data cleanup, not a schema change. "user".email/phone are @unique, and
-- Postgres treats "" as a real (colliding) value unlike NULL (multiple
-- NULLs are allowed under a unique index). A frontend form bug used to send
-- "" for an untouched Email field on staff/parent-account creation, so any
-- second blank-email signup after the first would fail with a unique-
-- constraint error. Fixed in StaffService/FamiliesService (see git log);
-- this migration repairs rows already written with the bug.
UPDATE "user" SET email = NULL WHERE email = '';
UPDATE "user" SET phone = NULL WHERE phone = '';
