CREATE TABLE user_growth_events (
 id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event_key VARCHAR(200) NOT NULL,
 kind VARCHAR(30) NOT NULL,
 points INTEGER NOT NULL,
 description VARCHAR(500) NOT NULL,
 rule_version VARCHAR(40) NOT NULL,
 earned_on DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Shanghai')::date),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reverses_id BIGINT UNIQUE REFERENCES user_growth_events(id),
 UNIQUE(user_id,event_key)
);
CREATE INDEX ix_growth_user_recent ON user_growth_events(user_id,id DESC);
CREATE INDEX ix_growth_user_day ON user_growth_events(user_id,earned_on,kind);
-- Existing completed marks are consumed without retroactive rewards.
INSERT INTO user_growth_events(user_id,event_key,kind,points,description,rule_version)
 SELECT user_id,'problem:'||problem_id,'BASELINE',0,'上线前已做记录，不补发经验','beta-1'
 FROM user_problem_states WHERE completed;
