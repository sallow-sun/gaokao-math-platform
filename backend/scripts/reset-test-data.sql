-- DANGER: internal-test environments only. This removes every row that depends
-- on users (PostgreSQL reports the CASCADE targets before committing).
-- Stop application traffic first, run this as one transaction, then register
-- the permanent administrator before reopening the environment.

BEGIN;

LOCK TABLE users IN ACCESS EXCLUSIVE MODE;
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- Keep the intended next value explicit even if the identity definition changes.
ALTER SEQUENCE users_id_seq RESTART WITH 1;

COMMIT;

-- Expected immediately after reset: last_value = 1, is_called = false.
SELECT last_value, is_called FROM users_id_seq;
