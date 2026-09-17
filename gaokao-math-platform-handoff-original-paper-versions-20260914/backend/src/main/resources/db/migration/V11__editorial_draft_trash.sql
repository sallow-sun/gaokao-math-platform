ALTER TABLE editorial_items ADD COLUMN trash_scope VARCHAR(16)
  CHECK (trash_scope IN ('DRAFT','PROBLEM'));
ALTER TABLE editorial_items ADD COLUMN trashed_at TIMESTAMPTZ;
UPDATE editorial_items SET trash_scope='PROBLEM',trashed_at=updated_at WHERE status='TRASH';
CREATE INDEX ix_editorial_draft_trash ON editorial_items(trashed_at DESC) WHERE trash_scope='DRAFT';
