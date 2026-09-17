-- Chapter names checked against the supplied five-volume textbook-directory PDF.
CREATE TABLE curricula(code VARCHAR(40) PRIMARY KEY, label TEXT NOT NULL, source TEXT NOT NULL);
INSERT INTO curricula VALUES ('PEP-A-2019','人教A版（2019）','普通高中《数学》（共5册）课本目录（人教A版） - 知乎.pdf');
CREATE TABLE curriculum_chapters (
 curriculum_code VARCHAR(40) REFERENCES curricula(code), code VARCHAR(20), book TEXT NOT NULL,
 book_order INTEGER NOT NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL,
 PRIMARY KEY(curriculum_code,code), UNIQUE(curriculum_code,sort_order)
);
CREATE TABLE curriculum_presets (
 id VARCHAR(30) PRIMARY KEY, curriculum_code VARCHAR(40) REFERENCES curricula(code),
 label TEXT NOT NULL, chapter_codes JSONB NOT NULL, sort_order INTEGER NOT NULL,
 version BIGINT NOT NULL DEFAULT 1
);
CREATE TABLE problem_curriculum (
 problem_id BIGINT PRIMARY KEY REFERENCES problems(id) ON DELETE CASCADE,
 curriculum_code VARCHAR(40) NOT NULL REFERENCES curricula(code), confirmed BOOLEAN NOT NULL DEFAULT FALSE,
 UNIQUE(problem_id,curriculum_code)
);
CREATE TABLE problem_chapters (
 problem_id BIGINT NOT NULL, curriculum_code VARCHAR(40) NOT NULL, chapter_code VARCHAR(20) NOT NULL,
 PRIMARY KEY(problem_id,curriculum_code,chapter_code),
 FOREIGN KEY(problem_id,curriculum_code) REFERENCES problem_curriculum(problem_id,curriculum_code) ON DELETE CASCADE,
 FOREIGN KEY(curriculum_code,chapter_code) REFERENCES curriculum_chapters(curriculum_code,code)
);
CREATE INDEX ix_problem_chapters_lookup ON problem_chapters(curriculum_code,chapter_code,problem_id);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A11','必修第一册',1,'第一章 集合与常用逻辑用语',1);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A12','必修第一册',1,'第二章 一元二次函数、方程和不等式',2);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A13','必修第一册',1,'第三章 函数的概念与性质',3);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A14','必修第一册',1,'第四章 指数函数与对数函数',4);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A15','必修第一册',1,'第五章 三角函数',5);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A21','必修第二册',2,'第六章 平面向量及其应用',6);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A22','必修第二册',2,'第七章 复数',7);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A23','必修第二册',2,'第八章 立体几何初步',8);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A24','必修第二册',2,'第九章 统计',9);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A25','必修第二册',2,'第十章 概率',10);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A31','选择性必修第一册',3,'第一章 空间向量与立体几何',11);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A32','选择性必修第一册',3,'第二章 直线和圆的方程',12);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A33','选择性必修第一册',3,'第三章 圆锥曲线的方程',13);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A41','选择性必修第二册',4,'第四章 数列',14);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A42','选择性必修第二册',4,'第五章 一元函数的导数及其应用',15);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A51','选择性必修第三册',5,'第六章 计数原理',16);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A52','选择性必修第三册',5,'第七章 随机变量及其分布',17);
INSERT INTO curriculum_chapters VALUES ('PEP-A-2019','A53','选择性必修第三册',5,'第八章 成对数据的统计分析',18);
INSERT INTO curriculum_presets(id,curriculum_code,label,chapter_codes,sort_order) VALUES ('semester-1','PEP-A-2019','学完高一上','["A11", "A12", "A13", "A14", "A15"]',1);
INSERT INTO curriculum_presets(id,curriculum_code,label,chapter_codes,sort_order) VALUES ('semester-2','PEP-A-2019','学完高一下','["A11", "A12", "A13", "A14", "A15", "A21", "A22", "A23", "A24", "A25"]',2);
INSERT INTO curriculum_presets(id,curriculum_code,label,chapter_codes,sort_order) VALUES ('semester-3','PEP-A-2019','学完高二上','["A11", "A12", "A13", "A14", "A15", "A21", "A22", "A23", "A24", "A25", "A31", "A32", "A33", "A41"]',3);
INSERT INTO curriculum_presets(id,curriculum_code,label,chapter_codes,sort_order) VALUES ('semester-4','PEP-A-2019','学完高二下','["A11", "A12", "A13", "A14", "A15", "A21", "A22", "A23", "A24", "A25", "A31", "A32", "A33", "A41", "A42", "A51", "A52", "A53"]',4);
INSERT INTO curriculum_presets(id,curriculum_code,label,chapter_codes,sort_order) VALUES ('semester-5','PEP-A-2019','学完高三上','["A11", "A12", "A13", "A14", "A15", "A21", "A22", "A23", "A24", "A25", "A31", "A32", "A33", "A41", "A42", "A51", "A52", "A53"]',5);
INSERT INTO curriculum_presets(id,curriculum_code,label,chapter_codes,sort_order) VALUES ('semester-6','PEP-A-2019','学完高三下','["A11", "A12", "A13", "A14", "A15", "A21", "A22", "A23", "A24", "A25", "A31", "A32", "A33", "A41", "A42", "A51", "A52", "A53"]',6);
