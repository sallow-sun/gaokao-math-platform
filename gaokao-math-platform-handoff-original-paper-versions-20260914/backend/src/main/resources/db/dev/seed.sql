-- 可选开发数据：数据库初始化后手动执行。
INSERT INTO problems(problem_number, title, year, region, source_code, question_type, difficulty, content, answer, solution)
VALUES
('P10001', '二次函数基础', 2026, '全国', 'national-new-1', 'single-choice', 'green',
 '已知 $f(x)=x^2-2x+1$，则 $f(x)$ 的最小值为（ ）', '$0$', '因为 $$f(x)=(x-1)^2\ge 0$$，所以最小值为 $0$。'),
('P10002', '导数与单调性', 2026, '全国', 'national-new-1', 'solution', 'yellow',
 '设 $f(x)=x^3-3x$，讨论其单调区间。', '递增区间为 $(-\infty,-1)$ 与 $(1,+\infty)$。', '有 $$f''(x)=3x^2-3$$，据导数符号讨论。')
ON CONFLICT (problem_number) DO NOTHING;

INSERT INTO problem_tags(problem_id, tag_id)
SELECT p.id, t.id FROM problems p JOIN tags t ON t.name='函数' WHERE p.problem_number='P10001'
ON CONFLICT (problem_id, tag_id) DO NOTHING;
INSERT INTO problem_tags(problem_id, tag_id)
SELECT p.id, t.id FROM problems p JOIN tags t ON t.name IN ('函数','导数') WHERE p.problem_number='P10002'
ON CONFLICT (problem_id, tag_id) DO NOTHING;
