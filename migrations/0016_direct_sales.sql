ALTER TABLE customers ADD COLUMN is_transient INTEGER NOT NULL DEFAULT 0;

ALTER TABLE delivery_notes ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE delivery_notes ADD COLUMN transaction_token TEXT;

ALTER TABLE invoices ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE invoices ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE invoices ADD COLUMN collection_id INTEGER REFERENCES collections(id);
ALTER TABLE invoices ADD COLUMN transaction_token TEXT;

ALTER TABLE collections ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE collections ADD COLUMN delivery_note_id INTEGER REFERENCES delivery_notes(id);
ALTER TABLE collections ADD COLUMN invoice_id INTEGER REFERENCES invoices(id);
ALTER TABLE collections ADD COLUMN transaction_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_notes_transaction_token ON delivery_notes(transaction_token) WHERE transaction_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_transaction_token ON invoices(transaction_token) WHERE transaction_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_transaction_token ON collections(transaction_token) WHERE transaction_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collections_invoice ON collections(invoice_id);

