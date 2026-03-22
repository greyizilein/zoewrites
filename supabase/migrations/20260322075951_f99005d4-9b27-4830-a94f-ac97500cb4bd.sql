ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS purpose_scope text,
ADD COLUMN IF NOT EXISTS learning_outcomes text,
ADD COLUMN IF NOT EXISTS required_inputs text,
ADD COLUMN IF NOT EXISTS structure_formatting text,
ADD COLUMN IF NOT EXISTS constraints_text text,
ADD COLUMN IF NOT EXISTS suggested_frameworks jsonb DEFAULT '[]'::jsonb;