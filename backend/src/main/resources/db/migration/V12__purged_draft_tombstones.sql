ALTER TABLE editorial_items ADD COLUMN purged_at TIMESTAMPTZ;
UPDATE editorial_items i SET purged_at=p.purged_at
FROM problems p WHERE p.problem_number=i.problem_number AND p.purged_at IS NOT NULL;
