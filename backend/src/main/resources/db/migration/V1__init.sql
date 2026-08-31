CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    uid VARCHAR(32) NOT NULL UNIQUE,
    username VARCHAR(40) NOT NULL UNIQUE,
    email VARCHAR(320) NOT NULL UNIQUE,
    phone VARCHAR(32) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    signature VARCHAR(80) NOT NULL DEFAULT '',
    role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BANNED')),
    session_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_users_email_lower ON users (LOWER(email));

CREATE TABLE problem_sources (
    code VARCHAR(64) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE problems (
    id BIGSERIAL PRIMARY KEY,
    problem_number VARCHAR(32) NOT NULL UNIQUE,
    title VARCHAR(255),
    year INTEGER,
    region VARCHAR(100),
    source_code VARCHAR(64) REFERENCES problem_sources(code) ON UPDATE CASCADE ON DELETE RESTRICT,
    question_type VARCHAR(32) NOT NULL CHECK (question_type IN ('single-choice', 'multiple-choice', 'fill-blank', 'solution')),
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('white', 'green', 'cyan', 'blue', 'yellow', 'orange', 'red', 'purple', 'black')),
    content TEXT NOT NULL,
    answer TEXT,
    solution TEXT,
    content_format VARCHAR(40) NOT NULL DEFAULT 'markdown-latex-v1',
    creator_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    favorite_count BIGINT NOT NULL DEFAULT 0 CHECK (favorite_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_problems_year ON problems(year);
CREATE INDEX ix_problems_source ON problems(source_code);
CREATE INDEX ix_problems_type ON problems(question_type);
CREATE INDEX ix_problems_difficulty ON problems(difficulty);
CREATE INDEX ix_problems_created_at ON problems(created_at);

CREATE TABLE problem_tags (
    id BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(problem_id, tag_id)
);
CREATE INDEX ix_problem_tags_tag ON problem_tags(tag_id, problem_id);

CREATE TABLE user_problem_states (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, problem_id)
);
CREATE INDEX ix_user_problem_states_user ON user_problem_states(user_id);

CREATE OR REPLACE FUNCTION sync_problem_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.favorite THEN
            UPDATE problems SET favorite_count = favorite_count + 1 WHERE id = NEW.problem_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.favorite IS DISTINCT FROM NEW.favorite THEN
            UPDATE problems
            SET favorite_count = GREATEST(0, favorite_count + CASE WHEN NEW.favorite THEN 1 ELSE -1 END)
            WHERE id = NEW.problem_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.favorite THEN
            UPDATE problems SET favorite_count = GREATEST(0, favorite_count - 1) WHERE id = OLD.problem_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_problem_favorite_count
AFTER INSERT OR UPDATE OF favorite OR DELETE ON user_problem_states
FOR EACH ROW EXECUTE FUNCTION sync_problem_favorite_count();

CREATE TABLE practice_lists (
    id BIGSERIAL PRIMARY KEY,
    public_id UUID NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_practice_lists_user ON practice_lists(user_id, updated_at DESC);
CREATE UNIQUE INDEX ux_practice_default_per_user ON practice_lists(user_id) WHERE is_default = TRUE;

CREATE TABLE practice_list_items (
    id BIGSERIAL PRIMARY KEY,
    practice_list_id BIGINT NOT NULL REFERENCES practice_lists(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(practice_list_id, problem_id)
);
CREATE INDEX ix_practice_items_order ON practice_list_items(practice_list_id, position, id);

CREATE TABLE problem_assets (
    id BIGSERIAL PRIMARY KEY,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    alt_text VARCHAR(255) NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(60) NOT NULL,
    target_id VARCHAR(100),
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_audit_logs_created ON audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON problem_sources
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tags_updated BEFORE UPDATE ON tags
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_problems_updated BEFORE UPDATE ON problems
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_states_updated BEFORE UPDATE ON user_problem_states
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lists_updated BEFORE UPDATE ON practice_lists
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_list_items_updated BEFORE UPDATE ON practice_list_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO problem_sources(code, label, sort_order) VALUES
('national-new-1', '新高考Ⅰ卷', 10),
('national-new-2', '新高考Ⅱ卷', 20),
('national-a', '全国甲卷', 30),
('local', '地方题', 40),
('mock', '模拟题', 50);

INSERT INTO tags(name, sort_order) VALUES
('集合', 10), ('函数', 20), ('导数', 30), ('数列', 40), ('三角函数', 50),
('平面向量', 60), ('不等式', 70), ('立体几何', 80), ('解析几何', 90),
('概率统计', 100), ('排列组合', 110), ('复数', 120), ('逻辑与命题', 130),
('算法与程序框图', 140);
