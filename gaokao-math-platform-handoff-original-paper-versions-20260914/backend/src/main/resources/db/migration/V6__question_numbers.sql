-- Keep numeric primary keys (favorites, lists and attachments) unchanged.
CREATE TABLE problem_number_aliases (
  old_number VARCHAR(32) PRIMARY KEY,
  problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE
);
CREATE INDEX ix_problem_number_aliases_problem ON problem_number_aliases(problem_id);

CREATE FUNCTION question_source_category(description TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN COALESCE(description,'') ~ '(课本|教材|教科书)' THEN 'T'
    WHEN COALESCE(description,'') ~ '(模拟|联考|月考|期中|期末|质检|调研|适应性|一模|二模|三模|竞赛|学业水平)' THEN 'E'
    WHEN COALESCE(description,'') ~ '(高考|全国.*卷|新课标.*卷|national-)' THEN 'G'
    ELSE 'N' END
$$;
CREATE FUNCTION question_type_letter(kind TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE kind WHEN 'single-choice' THEN 'C' WHEN 'multiple-choice' THEN 'M'
    WHEN 'fill-blank' THEN 'F' WHEN 'solution' THEN 'S' END
$$;

CREATE TEMP TABLE question_number_migration ON COMMIT DROP AS
SELECT p.id, p.problem_number AS old_number,
  question_source_category(concat_ws(' ',p.title,p.source_code,s.label))
  || question_type_letter(p.question_type)
  || lpad((row_number() OVER (ORDER BY p.created_at,p.id))::text,6,'0') AS new_number
FROM problems p LEFT JOIN problem_sources s ON s.code=p.source_code;
DO $$ BEGIN
  IF (SELECT count(*) FROM problems) > 999999 THEN
    RAISE EXCEPTION 'Six digit question number capacity exceeded';
  END IF;
  IF EXISTS (SELECT 1 FROM question_number_migration a JOIN question_number_migration b
    ON a.old_number=b.new_number AND a.id<>b.id) THEN
    RAISE EXCEPTION 'Existing question number collides with a new number; manual mapping required';
  END IF;
END $$;
INSERT INTO problem_number_aliases SELECT old_number,id FROM question_number_migration WHERE old_number<>new_number;
UPDATE editorial_items e SET problem_number=m.new_number
FROM question_number_migration m WHERE e.problem_number=m.old_number;
UPDATE problems p SET problem_number=m.new_number FROM question_number_migration m WHERE p.id=m.id;

-- Transactional counter: all prefixes share one allocation; failed publications do not consume it.
CREATE TABLE question_number_counter (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  last_number INTEGER NOT NULL CHECK(last_number BETWEEN 0 AND 999999)
);
INSERT INTO question_number_counter SELECT TRUE,count(*)::integer FROM problems;

CREATE FUNCTION allocate_question_number(category TEXT,kind TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE serial INTEGER;
BEGIN
  IF category IS NULL OR category NOT IN ('G','E','T','N') OR question_type_letter(kind) IS NULL THEN
    RAISE EXCEPTION 'Invalid question category or type';
  END IF;
  UPDATE question_number_counter SET last_number=last_number+1
    WHERE singleton AND last_number<999999 RETURNING last_number INTO serial;
  IF serial IS NULL THEN RAISE EXCEPTION 'Question number capacity exhausted (999999)'; END IF;
  RETURN category || question_type_letter(kind) || lpad(serial::text,6,'0');
END $$;
