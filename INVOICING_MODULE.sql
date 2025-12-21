-- Enable UUID extension if not
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Invoices Table: Stores immutable financial snapshot of a completed booking
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES athome_bookings(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE, -- Format: INV-YYYY-SEQ
    customer_snapshot JSONB NOT NULL, -- Stores name, address, phone at time of booking
    items_snapshot JSONB NOT NULL, -- Stores services/products details at time of booking
    financial_breakdown JSONB NOT NULL, -- { total_amount, platform_commission, beautician_payout, tax }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'VOID', 'REFUNDED')),
    UNIQUE(booking_id)
);

-- 2. Beautician Payouts: Tracks amount owed to beauticians
CREATE TABLE IF NOT EXISTS beautician_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    beautician_id UUID NOT NULL REFERENCES beauticians(id),
    booking_id UUID NOT NULL REFERENCES athome_bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'CDF',
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(booking_id)
);

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_payouts_beautician_id ON beautician_payouts(beautician_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON beautician_payouts(status);

-- 4. Function to generate sequential invoice numbers safely
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq;

CREATE OR REPLACE FUNCTION generate_invoice_number() 
RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
