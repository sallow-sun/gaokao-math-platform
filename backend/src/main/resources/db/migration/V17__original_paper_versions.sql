ALTER TABLE editorial_papers ADD COLUMN assembly JSONB NOT NULL DEFAULT '{}';
ALTER TABLE editorial_papers ADD COLUMN assembly_version BIGINT NOT NULL DEFAULT 1;
ALTER TABLE shared_papers ADD COLUMN original_paper_id UUID REFERENCES editorial_papers(id);
ALTER TABLE shared_papers ADD COLUMN revision INTEGER;
ALTER TABLE shared_papers ADD COLUMN revision_note VARCHAR(500);
CREATE UNIQUE INDEX ux_original_revision ON shared_papers(original_paper_id,revision);

-- Published original content cannot be changed, even when its certification is withdrawn.
CREATE FUNCTION protect_original_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.original_paper_id IS NOT NULL AND OLD.published AND
   (NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.original_paper_id IS DISTINCT FROM OLD.original_paper_id OR NEW.revision IS DISTINCT FROM OLD.revision
    OR NEW.question_count IS DISTINCT FROM OLD.question_count OR NEW.total_score IS DISTINCT FROM OLD.total_score
    OR NEW.year IS DISTINCT FROM OLD.year OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.exam_mode IS DISTINCT FROM OLD.exam_mode OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.description IS DISTINCT FROM OLD.description OR NEW.revision_note IS DISTINCT FROM OLD.revision_note
    OR NEW.has_answers IS DISTINCT FROM OLD.has_answers OR NEW.published IS DISTINCT FROM OLD.published) THEN
   RAISE EXCEPTION 'Published original papers are immutable; publish a new revision';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER original_snapshot_immutable BEFORE UPDATE ON shared_papers
 FOR EACH ROW EXECUTE FUNCTION protect_original_snapshot();
