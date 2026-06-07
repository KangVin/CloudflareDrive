-- Add hash column for file deduplication (instant upload)
ALTER TABLE files ADD COLUMN hash TEXT;
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
