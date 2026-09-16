-- Keep the original importer PDF and per-question page locations attached to real drafts.
-- The PDF remains in the importer; MathSea stores only an authenticated reference.
CREATE TABLE editorial_import_sources (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL UNIQUE REFERENCES editorial_batches(id) ON DELETE CASCADE,
  paper_id UUID NOT NULL REFERENCES editorial_papers(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  external_job_id VARCHAR(128) NOT NULL,
  source_filename VARCHAR(255) NOT NULL,
  source_checksum VARCHAR(64) NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, external_job_id)
);

CREATE TABLE editorial_item_source_refs (
  item_id UUID PRIMARY KEY REFERENCES editorial_items(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES editorial_import_sources(id) ON DELETE CASCADE,
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  spans JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX ix_editorial_item_source_refs_source
  ON editorial_item_source_refs(source_id);
