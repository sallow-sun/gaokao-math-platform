CREATE TABLE shared_papers (
 id UUID PRIMARY KEY,
 owner_id BIGINT NOT NULL REFERENCES users(id),
 title VARCHAR(160) NOT NULL,
 description VARCHAR(2000) NOT NULL DEFAULT '',
 source VARCHAR(160) NOT NULL DEFAULT '',
 year INTEGER,
 exam_mode VARCHAR(80) NOT NULL DEFAULT '',
 kind VARCHAR(12) NOT NULL CHECK(kind IN ('PDF','BUILDER')),
 snapshot JSONB,
 object_key TEXT,
 file_bytes BIGINT,
 question_count INTEGER,
 total_score NUMERIC,
 has_answers BOOLEAN NOT NULL DEFAULT false,
 published BOOLEAN NOT NULL DEFAULT false,
 deleted BOOLEAN NOT NULL DEFAULT false,
 checked_by BIGINT REFERENCES users(id),
 checked_at TIMESTAMPTZ,
 check_note VARCHAR(500),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_shared_papers_public ON shared_papers(created_at DESC) WHERE published AND NOT deleted;
CREATE INDEX ix_shared_papers_owner ON shared_papers(owner_id,created_at DESC);
CREATE TABLE shared_paper_ratings (
 paper_id UUID NOT NULL REFERENCES shared_papers(id),
 user_id BIGINT NOT NULL REFERENCES users(id),
 difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 5),
 alignment INTEGER NOT NULL CHECK(alignment BETWEEN 1 AND 5),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(paper_id,user_id)
);
CREATE TABLE shared_paper_favorites (
 paper_id UUID NOT NULL REFERENCES shared_papers(id),
 user_id BIGINT NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(paper_id,user_id)
);
CREATE TABLE shared_paper_uses (
 paper_id UUID NOT NULL REFERENCES shared_papers(id),
 user_id BIGINT NOT NULL REFERENCES users(id),
 day DATE NOT NULL DEFAULT CURRENT_DATE,
 PRIMARY KEY(paper_id,user_id,day)
);
