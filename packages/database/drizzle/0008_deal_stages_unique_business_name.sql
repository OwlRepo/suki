-- Remove duplicate deal_stages (keep one per business_id, name with smallest id)
DELETE FROM deal_stages a
USING deal_stages b
WHERE a.business_id = b.business_id
  AND a.name = b.name
  AND a.id > b.id;

-- Add unique constraint to prevent future duplicates
ALTER TABLE "deal_stages" ADD CONSTRAINT "deal_stages_business_id_name_unique" UNIQUE ("business_id", "name");
