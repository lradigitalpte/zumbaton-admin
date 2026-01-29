-- Add gender field to registration_forms table
ALTER TABLE registration_forms ADD COLUMN IF NOT EXISTS gender TEXT;
