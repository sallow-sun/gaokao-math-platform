-- Original assignments are retained for migration audit and future reclassification.
CREATE TABLE tag_assignment_archive AS SELECT pt.problem_id,t.name AS tag_name FROM problem_tags pt JOIN tags t ON t.id=pt.tag_id;
CREATE TABLE tag_aliases (alias TEXT PRIMARY KEY, canonical TEXT NOT NULL);
CREATE TABLE tag_chapter_mapping (tag_name TEXT NOT NULL, chapter_code VARCHAR(8) NOT NULL, PRIMARY KEY(tag_name,chapter_code));
INSERT INTO tags(name,sort_order,active) VALUES ('集合与逻辑',0,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('集合与逻辑','集合与逻辑');
INSERT INTO tag_aliases VALUES ('集合逻辑','集合与逻辑');
INSERT INTO tag_aliases VALUES ('集合','集合与逻辑');
INSERT INTO tag_aliases VALUES ('集合的运算','集合与逻辑');
INSERT INTO tag_aliases VALUES ('常用逻辑用语','集合与逻辑');
INSERT INTO tag_aliases VALUES ('逻辑','集合与逻辑');
INSERT INTO tag_aliases VALUES ('逻辑与命题','集合与逻辑');
INSERT INTO tag_chapter_mapping VALUES ('集合与逻辑','A11');
INSERT INTO tags(name,sort_order,active) VALUES ('函数与导数',1,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('函数与导数','函数与导数');
INSERT INTO tag_aliases VALUES ('函数','函数与导数');
INSERT INTO tag_aliases VALUES ('函数性质','函数与导数');
INSERT INTO tag_aliases VALUES ('函数的概念与性质','函数与导数');
INSERT INTO tag_aliases VALUES ('指数与对数','函数与导数');
INSERT INTO tag_aliases VALUES ('指数函数','函数与导数');
INSERT INTO tag_aliases VALUES ('对数函数','函数与导数');
INSERT INTO tag_aliases VALUES ('导数','函数与导数');
INSERT INTO tag_aliases VALUES ('导数及其应用','函数与导数');
INSERT INTO tag_aliases VALUES ('一元函数的导数及其应用','函数与导数');
INSERT INTO tag_chapter_mapping VALUES ('函数与导数','A13');
INSERT INTO tag_chapter_mapping VALUES ('函数与导数','A14');
INSERT INTO tag_chapter_mapping VALUES ('函数与导数','A42');
INSERT INTO tags(name,sort_order,active) VALUES ('三角与解三角形',2,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('三角与解三角形','三角与解三角形');
INSERT INTO tag_aliases VALUES ('三角函数','三角与解三角形');
INSERT INTO tag_aliases VALUES ('三角恒等变换','三角与解三角形');
INSERT INTO tag_aliases VALUES ('解三角形','三角与解三角形');
INSERT INTO tag_chapter_mapping VALUES ('三角与解三角形','A15');
INSERT INTO tag_chapter_mapping VALUES ('三角与解三角形','A21');
INSERT INTO tags(name,sort_order,active) VALUES ('数列',3,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('数列','数列');
INSERT INTO tag_aliases VALUES ('等差数列','数列');
INSERT INTO tag_aliases VALUES ('等比数列','数列');
INSERT INTO tag_aliases VALUES ('数列求和','数列');
INSERT INTO tag_chapter_mapping VALUES ('数列','A41');
INSERT INTO tags(name,sort_order,active) VALUES ('不等式',4,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('不等式','不等式');
INSERT INTO tag_aliases VALUES ('基本不等式','不等式');
INSERT INTO tag_aliases VALUES ('一元二次不等式','不等式');
INSERT INTO tag_chapter_mapping VALUES ('不等式','A12');
INSERT INTO tags(name,sort_order,active) VALUES ('平面向量',5,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('平面向量','平面向量');
INSERT INTO tag_chapter_mapping VALUES ('平面向量','A21');
INSERT INTO tags(name,sort_order,active) VALUES ('解析几何',6,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('解析几何','解析几何');
INSERT INTO tag_aliases VALUES ('解几','解析几何');
INSERT INTO tag_aliases VALUES ('直线与圆','解析几何');
INSERT INTO tag_aliases VALUES ('直线和圆的方程','解析几何');
INSERT INTO tag_aliases VALUES ('圆锥曲线','解析几何');
INSERT INTO tag_aliases VALUES ('椭圆','解析几何');
INSERT INTO tag_aliases VALUES ('双曲线','解析几何');
INSERT INTO tag_aliases VALUES ('抛物线','解析几何');
INSERT INTO tag_chapter_mapping VALUES ('解析几何','A32');
INSERT INTO tag_chapter_mapping VALUES ('解析几何','A33');
INSERT INTO tags(name,sort_order,active) VALUES ('立体几何',7,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('立体几何','立体几何');
INSERT INTO tag_aliases VALUES ('空间位置关系','立体几何');
INSERT INTO tag_aliases VALUES ('空间向量','立体几何');
INSERT INTO tag_aliases VALUES ('空间角与距离','立体几何');
INSERT INTO tag_chapter_mapping VALUES ('立体几何','A23');
INSERT INTO tag_chapter_mapping VALUES ('立体几何','A31');
INSERT INTO tags(name,sort_order,active) VALUES ('概率与统计',8,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('概率与统计','概率与统计');
INSERT INTO tag_aliases VALUES ('概率','概率与统计');
INSERT INTO tag_aliases VALUES ('统计','概率与统计');
INSERT INTO tag_aliases VALUES ('随机变量','概率与统计');
INSERT INTO tag_aliases VALUES ('计数原理','概率与统计');
INSERT INTO tag_aliases VALUES ('排列组合','概率与统计');
INSERT INTO tag_aliases VALUES ('概率统计','概率与统计');
INSERT INTO tag_chapter_mapping VALUES ('概率与统计','A24');
INSERT INTO tag_chapter_mapping VALUES ('概率与统计','A25');
INSERT INTO tag_chapter_mapping VALUES ('概率与统计','A51');
INSERT INTO tag_chapter_mapping VALUES ('概率与统计','A52');
INSERT INTO tag_chapter_mapping VALUES ('概率与统计','A53');
INSERT INTO tags(name,sort_order,active) VALUES ('复数',9,true) ON CONFLICT(name) DO UPDATE SET sort_order=excluded.sort_order,active=true;
INSERT INTO tag_aliases VALUES ('复数','复数');
INSERT INTO tag_chapter_mapping VALUES ('复数','A22');
DELETE FROM problem_tags;
INSERT INTO problem_tags(problem_id,tag_id) SELECT DISTINCT a.problem_id,t.id FROM tag_assignment_archive a JOIN tag_aliases x ON x.alias=a.tag_name JOIN tags t ON t.name=x.canonical;
UPDATE tags SET active=false WHERE name NOT IN (SELECT canonical FROM tag_aliases);
UPDATE editorial_items e SET payload=jsonb_set(jsonb_set(payload,'{tags}',coalesce((SELECT jsonb_agg(DISTINCT a.canonical) FROM jsonb_array_elements_text(coalesce(e.payload->'tags','[]')) v JOIN tag_aliases a ON a.alias=v),'[]')),'{originalMetadata}',coalesce(payload->'originalMetadata','{}') || jsonb_build_object('legacy_tags',coalesce(payload->'tags','[]')::text)),version=version+1 WHERE status<>'TRASH';
-- Explicitly confirmed chapters take priority. Otherwise require all chapters of all known TAGs.
ALTER TABLE problems ADD COLUMN tag_mapping_blocked BOOLEAN NOT NULL DEFAULT false;
UPDATE problems p SET tag_mapping_blocked=true WHERE EXISTS(SELECT 1 FROM tag_assignment_archive a WHERE a.problem_id=p.id AND NOT EXISTS(SELECT 1 FROM tag_aliases x WHERE x.alias=a.tag_name));
UPDATE editorial_items e SET payload=jsonb_set(payload,'{originalMetadata,unmapped_tags}',to_jsonb('旧标签需要整理'::text)) WHERE EXISTS(SELECT 1 FROM jsonb_array_elements_text((payload->'originalMetadata'->>'legacy_tags')::jsonb) v WHERE NOT EXISTS(SELECT 1 FROM tag_aliases a WHERE a.alias=v));
CREATE VIEW effective_problem_chapters AS
SELECT ch.problem_id,ch.chapter_code FROM problem_chapters ch JOIN problem_curriculum pc USING(problem_id,curriculum_code) WHERE pc.confirmed AND pc.curriculum_code='PEP-A-2019'
UNION
SELECT pt.problem_id,m.chapter_code FROM problem_tags pt JOIN tags t ON t.id=pt.tag_id JOIN tag_chapter_mapping m ON m.tag_name=t.name
WHERE NOT EXISTS(SELECT 1 FROM problem_curriculum pc WHERE pc.problem_id=pt.problem_id AND pc.confirmed)
AND NOT EXISTS(SELECT 1 FROM problem_tags u JOIN tags ut ON ut.id=u.tag_id WHERE u.problem_id=pt.problem_id AND NOT EXISTS(SELECT 1 FROM tag_chapter_mapping um WHERE um.tag_name=ut.name))
AND NOT EXISTS(SELECT 1 FROM problems p WHERE p.id=pt.problem_id AND p.tag_mapping_blocked);
CREATE TABLE problem_feedback (
 id BIGSERIAL PRIMARY KEY, problem_id BIGINT NOT NULL REFERENCES problems(id), user_id BIGINT NOT NULL REFERENCES users(id),
 kind VARCHAR(20) NOT NULL CHECK(kind IN ('题干／公式','答案','解析','图片','分类','其他')),
 description VARCHAR(3000) NOT NULL, suggestion VARCHAR(3000) NOT NULL DEFAULT '',
 problem_snapshot JSONB NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CHANGES','RESOLVED','DISMISSED')),
 response VARCHAR(1500) NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1, handled_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_feedback_queue ON problem_feedback(status,problem_id,created_at);
CREATE INDEX ix_feedback_user ON problem_feedback(user_id,created_at DESC);
ALTER TABLE problem_feedback ADD COLUMN image_url TEXT;
