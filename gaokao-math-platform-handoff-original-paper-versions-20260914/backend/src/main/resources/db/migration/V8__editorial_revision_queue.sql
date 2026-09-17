ALTER TABLE editorial_items DROP CONSTRAINT editorial_items_status_check;
ALTER TABLE editorial_items ADD CONSTRAINT editorial_items_status_check CHECK (status IN ('DRAFT','REVIEW','CHANGES','PUBLISHED'));
ALTER TABLE editorial_items ADD COLUMN issue_type VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE editorial_items ADD COLUMN claimed_at TIMESTAMPTZ;
UPDATE editorial_items SET claimed_at=now() WHERE claimed_by IS NOT NULL;
-- Existing unfinished working copies remain private and enter the review queue.
-- Preserve previously returned items in the correction queue.
UPDATE editorial_items i SET status='CHANGES' WHERE status='DRAFT' AND
  (SELECT action FROM editorial_history h WHERE h.item_id=i.id ORDER BY h.id DESC LIMIT 1)='RETURN';

INSERT INTO tags(name,sort_order,active) VALUES ('集合与逻辑',0,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('集合',1,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('常用逻辑用语',2,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('函数',3,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('函数性质',4,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('指数与对数',5,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('导数',6,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('解析几何',7,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('直线与圆',8,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('圆锥曲线',9,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('椭圆',10,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('双曲线',11,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('抛物线',12,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('立体几何',13,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('空间位置关系',14,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('空间向量',15,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('空间角与距离',16,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('三角函数',17,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('三角恒等变换',18,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('解三角形',19,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('数列',20,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('等差数列',21,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('等比数列',22,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('数列求和',23,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('概率与统计',24,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('概率',25,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('统计',26,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('随机变量',27,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('计数原理',28,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('平面向量',29,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('不等式',30,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('基本不等式',31,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('一元二次不等式',32,true) ON CONFLICT(name) DO NOTHING;
INSERT INTO tags(name,sort_order,active) VALUES ('复数',33,true) ON CONFLICT(name) DO NOTHING;