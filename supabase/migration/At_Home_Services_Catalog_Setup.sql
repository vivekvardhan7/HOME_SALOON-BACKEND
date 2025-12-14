-- =====================================================
-- SUPABASE SETUP SCRIPT FOR AT-HOME SERVICES
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: Create service_catalog table
-- =====================================================
CREATE TABLE IF NOT EXISTS service_catalog (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER DEFAULT 60,
  customer_price NUMERIC NOT NULL,
  vendor_payout NUMERIC NOT NULL,
  category TEXT,
  icon TEXT,
  allows_products BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for service_catalog
CREATE INDEX IF NOT EXISTS idx_service_catalog_slug ON service_catalog(slug);
CREATE INDEX IF NOT EXISTS idx_service_catalog_is_active ON service_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category);

-- =====================================================
-- STEP 2: Create product_catalog table
-- =====================================================
CREATE TABLE IF NOT EXISTS product_catalog (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image TEXT,
  customer_price NUMERIC NOT NULL,
  vendor_payout NUMERIC NOT NULL,
  sku TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for product_catalog
CREATE INDEX IF NOT EXISTS idx_product_catalog_slug ON product_catalog(slug);
CREATE INDEX IF NOT EXISTS idx_product_catalog_is_active ON product_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON product_catalog(category);

-- =====================================================
-- STEP 3: Add booking_type column to bookings table
-- =====================================================
-- Check if column exists, if not add it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'booking_type'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_type TEXT DEFAULT 'AT_HOME';
  END IF;
END $$;

-- Create index for booking_type
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON bookings(booking_type);

-- Update existing bookings to have default type if NULL
UPDATE bookings 
SET booking_type = 'AT_HOME' 
WHERE booking_type IS NULL;

-- =====================================================
-- STEP 4: Create function to auto-update updated_at timestamp
-- =====================================================
-- Function to update updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_service_catalog_updated_at ON service_catalog;
CREATE TRIGGER update_service_catalog_updated_at
  BEFORE UPDATE ON service_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_catalog_updated_at ON product_catalog;
CREATE TRIGGER update_product_catalog_updated_at
  BEFORE UPDATE ON product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 5: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS on tables
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies for service_catalog
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read active services" ON service_catalog;
DROP POLICY IF EXISTS "Allow admin full access services" ON service_catalog;
DROP POLICY IF EXISTS "Allow admin insert services" ON service_catalog;
DROP POLICY IF EXISTS "Allow admin update services" ON service_catalog;
DROP POLICY IF EXISTS "Allow admin delete services" ON service_catalog;

-- Policy: Allow anyone to read active services (for user-facing pages)
CREATE POLICY "Allow public read active services" ON service_catalog
  FOR SELECT
  USING (is_active = true);

-- Policy: Allow admins to read all services (including inactive)
CREATE POLICY "Allow admin read all services" ON service_catalog
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Allow admins to insert services
CREATE POLICY "Allow admin insert services" ON service_catalog
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Allow admins to update services
CREATE POLICY "Allow admin update services" ON service_catalog
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Allow admins to delete services
CREATE POLICY "Allow admin delete services" ON service_catalog
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- =====================================================
-- RLS Policies for product_catalog
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read active products" ON product_catalog;
DROP POLICY IF EXISTS "Allow admin read all products" ON product_catalog;
DROP POLICY IF EXISTS "Allow admin insert products" ON product_catalog;
DROP POLICY IF EXISTS "Allow admin update products" ON product_catalog;
DROP POLICY IF EXISTS "Allow admin delete products" ON product_catalog;

-- Policy: Allow anyone to read active products (for user-facing pages)
CREATE POLICY "Allow public read active products" ON product_catalog
  FOR SELECT
  USING (is_active = true);

-- Policy: Allow admins to read all products (including inactive)
CREATE POLICY "Allow admin read all products" ON product_catalog
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Allow admins to insert products
CREATE POLICY "Allow admin insert products" ON product_catalog
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Allow admins to update products
CREATE POLICY "Allow admin update products" ON product_catalog
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- Policy: Allow admins to delete products
CREATE POLICY "Allow admin delete products" ON product_catalog
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'ADMIN'
    )
  );

-- =====================================================
-- STEP 6: Verify tables and columns
-- =====================================================

-- Check if tables were created
SELECT 
  'service_catalog' as table_name,
  COUNT(*) as row_count
FROM service_catalog
UNION ALL
SELECT 
  'product_catalog' as table_name,
  COUNT(*) as row_count
FROM product_catalog;

-- Check if booking_type column exists
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings' 
AND column_name = 'booking_type';

-- =====================================================
-- STEP 7: Insert sample data (OPTIONAL - for testing)
-- =====================================================

-- Uncomment below to insert sample services and products for testing

/*
-- Sample Services
INSERT INTO service_catalog (id, slug, name, description, duration, customer_price, vendor_payout, category, icon, allows_products, is_active)
VALUES
  ('svc-001', 'hair-styling-cuts', 'Hair Styling & Cuts', 'Professional hair cutting and styling service', 60, 49.99, 30.00, 'Hair', 'Scissors', true, true),
  ('svc-002', 'hair-coloring', 'Hair Coloring & Highlights', 'Professional hair coloring and highlights', 90, 79.99, 50.00, 'Hair', 'Palette', true, true),
  ('svc-003', 'facial-treatment', 'Radiance Facial Treatment', 'Deep cleansing and rejuvenating facial', 75, 64.99, 38.00, 'Skin', 'Sparkles', true, true),
  ('svc-004', 'makeup-session', 'Professional Makeup Session', 'Complete makeup application for events', 70, 89.99, 55.00, 'Makeup', 'Palette', true, true),
  ('svc-005', 'nail-art', 'Signature Nail Art & Gel Finish', 'Creative nail art with gel polish', 60, 54.99, 32.00, 'Nail', 'Sparkles', true, true)
ON CONFLICT (id) DO NOTHING;

-- Sample Products
INSERT INTO product_catalog (id, slug, name, description, category, image, customer_price, vendor_payout, sku, is_active)
VALUES
  ('prod-001', 'hair-shampoo', 'Professional Hair Shampoo', 'Premium quality hair shampoo', 'Hair', 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop', 15.99, 8.00, 'HAIR-SHAM-001', true),
  ('prod-002', 'hair-conditioner', 'Hair Conditioner Deep Moisture', 'Deep conditioning treatment', 'Hair', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800&auto=format&fit=crop', 16.99, 8.50, 'HAIR-COND-001', true),
  ('prod-003', 'facial-cleanser', 'Facial Cleanser Gentle', 'Gentle facial cleansing formula', 'Skin', 'https://images.unsplash.com/photo-1522335789203-9d8aa9f4eebf?q=80&w=800&auto=format&fit=crop', 19.99, 10.00, 'SKIN-CLEAN-001', true),
  ('prod-004', 'facial-serum', 'Facial Serum Vitamin C', 'Vitamin C brightening serum', 'Skin', 'https://images.unsplash.com/photo-1556228720-195a672e8a03?q=80&w=800&auto=format&fit=crop', 32.99, 16.50, 'SKIN-SERUM-001', true),
  ('prod-005', 'makeup-foundation', 'Foundation Liquid', 'Long-lasting liquid foundation', 'Makeup', 'https://images.unsplash.com/photo-1512203492609-8f5fa3f5c1ee?q=80&w=800&auto=format&fit=crop', 28.99, 14.50, 'MAKEUP-FOUND-001', true)
ON CONFLICT (id) DO NOTHING;
*/

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Setup completed successfully!';
  RAISE NOTICE 'Tables created: service_catalog, product_catalog';
  RAISE NOTICE 'Column added: bookings.booking_type';
  RAISE NOTICE 'RLS policies configured for admin access';
  RAISE NOTICE 'You can now use the Admin Dashboard and At-Home Services features';
END $$;

