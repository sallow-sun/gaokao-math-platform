ALTER TABLE problems ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE problems ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE problems ADD COLUMN purged_at TIMESTAMPTZ;
ALTER TABLE editorial_items DROP CONSTRAINT editorial_items_status_check;
ALTER TABLE editorial_items ADD CONSTRAINT editorial_items_status_check CHECK (status IN ('DRAFT','REVIEW','CHANGES','PUBLISHED','TRASH'));
ALTER TABLE editorial_items ADD COLUMN trash_previous_status VARCHAR(16);
CREATE INDEX ix_problems_trash ON problems(deleted,deleted_at DESC);
