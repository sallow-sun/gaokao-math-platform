CREATE TABLE user_mistakes (
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,problem_id)
);
CREATE INDEX ix_user_mistakes_recent ON user_mistakes(user_id,created_at DESC);
