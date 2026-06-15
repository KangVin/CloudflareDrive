-- Add password protection for share links
ALTER TABLE shares ADD COLUMN password_hash TEXT;
ALTER TABLE shares ADD COLUMN password_salt TEXT;
