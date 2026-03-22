ALTER TABLE assessments ADD COLUMN IF NOT EXISTS source_date_from integer;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS source_date_to integer;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS use_seminal_sources boolean DEFAULT false;