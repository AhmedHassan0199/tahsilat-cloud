ALTER TABLE collections ADD COLUMN collection_type TEXT;
ALTER TABLE collections ADD COLUMN collection_type_other TEXT;

CREATE INDEX IF NOT EXISTS idx_collections_type ON collections(collection_type);
