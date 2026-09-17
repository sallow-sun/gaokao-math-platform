-- Keep deleted records for audit without reserving the source question identity forever.
ALTER TABLE editorial_items DROP CONSTRAINT editorial_items_paper_id_original_number_key;
CREATE UNIQUE INDEX ux_editorial_live_source_question
ON editorial_items(paper_id, original_number) WHERE purged_at IS NULL;
