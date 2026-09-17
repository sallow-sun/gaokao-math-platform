-- Existing published problems stay untouched. Working copies are private to admins.
CREATE TABLE editorial_permissions (
 user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 permission VARCHAR(16) NOT NULL CHECK (permission IN ('EDITOR','REVIEWER','MANAGER'))
);
INSERT INTO editorial_permissions SELECT id, 'MANAGER' FROM users WHERE role='ADMIN';

CREATE TABLE editorial_papers (
 id UUID PRIMARY KEY,
 identity_key VARCHAR(500) NOT NULL UNIQUE,
 title VARCHAR(255) NOT NULL,
 created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE editorial_batches (
 id UUID PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE editorial_items (
 id UUID PRIMARY KEY,
 paper_id UUID REFERENCES editorial_papers(id),
 original_number VARCHAR(80) NOT NULL,
 original_id VARCHAR(255) NOT NULL DEFAULT '',
 problem_number VARCHAR(32) UNIQUE,
 status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','PUBLISHED')),
 payload JSONB NOT NULL,
 raw_markdown TEXT,
 version BIGINT NOT NULL DEFAULT 1,
 claimed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(paper_id, original_number)
);
CREATE INDEX ix_editorial_queue ON editorial_items(status, updated_at DESC);
CREATE TABLE editorial_import_entries (
 batch_id UUID NOT NULL REFERENCES editorial_batches(id),
 path VARCHAR(1000) NOT NULL,
 checksum VARCHAR(64) NOT NULL,
 item_id UUID REFERENCES editorial_items(id),
 result VARCHAR(32) NOT NULL,
 message TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(batch_id,path)
);
CREATE TABLE editorial_import_fingerprints (
 item_id UUID NOT NULL REFERENCES editorial_items(id),
 checksum VARCHAR(64) NOT NULL,
 PRIMARY KEY(item_id,checksum)
);
CREATE TABLE editorial_history (
 id BIGSERIAL PRIMARY KEY,
 item_id UUID NOT NULL REFERENCES editorial_items(id),
 version BIGINT NOT NULL,
 action VARCHAR(32) NOT NULL,
 actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
 note TEXT NOT NULL DEFAULT '',
 payload JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_editorial_history ON editorial_history(item_id,id DESC);
CREATE TABLE editorial_assets (
 id UUID PRIMARY KEY,
 item_id UUID NOT NULL REFERENCES editorial_items(id),
 filename VARCHAR(255) NOT NULL,
 checksum VARCHAR(64) NOT NULL,
 url VARCHAR(500) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(item_id, filename, checksum)
);
