ALTER TABLE practice_lists
    ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN is_official BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX ix_practice_lists_public
    ON practice_lists(is_public, is_official, updated_at DESC);

ALTER TABLE practice_lists
    ADD CONSTRAINT ck_official_practice_lists_are_public
    CHECK (NOT is_official OR is_public);

CREATE OR REPLACE FUNCTION create_official_practice_list_for_first_user()
RETURNS TRIGGER AS $$
DECLARE
    official_list_id BIGINT;
BEGIN
    IF NEW.id = (SELECT MIN(id) FROM users) AND NOT EXISTS (
        SELECT 1 FROM practice_lists WHERE is_official = TRUE
    ) THEN
        INSERT INTO practice_lists(
            public_id, user_id, title, description, is_default, is_public, is_official
        ) VALUES (
            md5(random()::text || clock_timestamp()::text)::uuid,
            NEW.id,
            '官方起步题单',
            '数海官方维护的高考数学起步练习。',
            FALSE,
            TRUE,
            TRUE
        ) RETURNING id INTO official_list_id;

        INSERT INTO practice_list_items(practice_list_id, problem_id, position, note)
        SELECT official_list_id, p.id, ROW_NUMBER() OVER (ORDER BY p.problem_number) - 1, ''
        FROM problems p
        WHERE p.problem_number IN ('P10001', 'P10002')
        ON CONFLICT (practice_list_id, problem_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_official_list_for_first_user
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_official_practice_list_for_first_user();

DO $$
DECLARE
    first_user_id BIGINT;
    official_list_id BIGINT;
BEGIN
    SELECT MIN(id) INTO first_user_id FROM users;

    IF first_user_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM practice_lists WHERE is_official = TRUE
    ) THEN
        INSERT INTO practice_lists(
            public_id, user_id, title, description, is_default, is_public, is_official
        ) VALUES (
            md5(random()::text || clock_timestamp()::text)::uuid,
            first_user_id,
            '官方起步题单',
            '数海官方维护的高考数学起步练习。',
            FALSE,
            TRUE,
            TRUE
        ) RETURNING id INTO official_list_id;

        INSERT INTO practice_list_items(practice_list_id, problem_id, position, note)
        SELECT official_list_id, p.id, ROW_NUMBER() OVER (ORDER BY p.problem_number) - 1, ''
        FROM problems p
        WHERE p.problem_number IN ('P10001', 'P10002')
        ON CONFLICT (practice_list_id, problem_id) DO NOTHING;
    END IF;
END;
$$;
