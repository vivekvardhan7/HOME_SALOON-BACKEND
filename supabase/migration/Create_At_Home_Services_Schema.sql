-- =====================================================
-- At-Home Services Workflow - FIXED SQL Schema
-- This version handles all edge cases and existing tables
-- =====================================================

-- =====================================================
-- STEP 1: Create/Update service_catalog table
-- =====================================================
CREATE TABLE IF NOT EXISTS service_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER DEFAULT 60,
  customer_price NUMERIC(10, 2) NOT NULL,
  vendor_payout NUMERIC(10, 2) NOT NULL,
  category TEXT,
  icon TEXT,
  allows_products BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  slug TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add UNIQUE constraint to slug if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'service_catalog_slug_key'
  ) THEN
    ALTER TABLE service_catalog ADD CONSTRAINT service_catalog_slug_key UNIQUE (slug);
  END IF;
END $$;

-- =====================================================
-- STEP 2: Create/Update product_catalog table
-- =====================================================
CREATE TABLE IF NOT EXISTS product_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image TEXT,
  customer_price NUMERIC(10, 2) NOT NULL,
  vendor_payout NUMERIC(10, 2) NOT NULL,
  sku TEXT,
  is_active BOOLEAN DEFAULT true,
  slug TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add UNIQUE constraint to slug if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'product_catalog_slug_key'
  ) THEN
    ALTER TABLE product_catalog ADD CONSTRAINT product_catalog_slug_key UNIQUE (slug);
  END IF;
END $$;

-- =====================================================
-- STEP 3: Create/Update employees table
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  specialization TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add manager_id column separately
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'manager_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN manager_id UUID REFERENCES users(id);
  END IF;
END $$;

-- =====================================================
-- STEP 4: Create other required tables
-- =====================================================
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT,
  name TEXT,
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  zip_code TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  gateway_id TEXT,
  gateway_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  product_catalog_id TEXT NOT NULL REFERENCES product_catalog(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- STEP 5: Add columns to existing tables
-- =====================================================

-- Add booking_type to bookings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'booking_type'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_type TEXT;
  END IF;
END $$;

-- Add manager_id to bookings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'manager_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN manager_id UUID REFERENCES users(id);
  END IF;
END $$;

-- Add employee_id to bookings (without FK constraint first)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'employee_id'
  ) THEN
    -- Add column without foreign key first
    ALTER TABLE bookings ADD COLUMN employee_id UUID;
    
    -- Try to add foreign key constraint separately if employees table exists
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employees') THEN
        ALTER TABLE bookings 
        ADD CONSTRAINT bookings_employee_id_fkey 
        FOREIGN KEY (employee_id) REFERENCES employees(id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If FK constraint fails, just continue without it
      RAISE NOTICE 'Could not add foreign key constraint for employee_id';
    END;
  END IF;
END $$;

-- Add catalog_service_id to booking_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'booking_items' AND column_name = 'catalog_service_id'
  ) THEN
    ALTER TABLE booking_items ADD COLUMN catalog_service_id TEXT REFERENCES service_catalog(id);
  END IF;
END $$;

-- =====================================================
-- STEP 6: Create indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_service_catalog_is_active ON service_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON service_catalog(category);
CREATE INDEX IF NOT EXISTS idx_product_catalog_is_active ON product_catalog(is_active);
CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON product_catalog(category);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_type ON bookings(booking_type);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_employee_id ON bookings(employee_id);
CREATE INDEX IF NOT EXISTS idx_bookings_manager_id ON bookings(manager_id);
CREATE INDEX IF NOT EXISTS idx_booking_items_catalog_service ON booking_items(catalog_service_id);
CREATE INDEX IF NOT EXISTS idx_booking_products_booking_id ON booking_products(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_products_product_catalog_id ON booking_products(product_catalog_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);

-- =====================================================
-- STEP 7: Enable RLS
-- =====================================================
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_products ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN
    ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'booking_items') THEN
    ALTER TABLE booking_items ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =====================================================
-- STEP 8: Create RLS Policies
-- =====================================================

-- Service Catalog Policies
DROP POLICY IF EXISTS "Allow read active services" ON service_catalog;
DROP POLICY IF EXISTS "Allow admin manage services" ON service_catalog;

CREATE POLICY "Allow read active services" ON service_catalog
  FOR SELECT 
  USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "Allow admin manage services" ON service_catalog
  FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN'));

-- Product Catalog Policies
DROP POLICY IF EXISTS "Allow read active products" ON product_catalog;
DROP POLICY IF EXISTS "Allow admin manage products" ON product_catalog;

CREATE POLICY "Allow read active products" ON product_catalog
  FOR SELECT 
  USING (is_active = true AND auth.role() = 'authenticated');

CREATE POLICY "Allow admin manage products" ON product_catalog
  FOR ALL 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'ADMIN'));

-- Bookings Policies
DROP POLICY IF EXISTS "Allow customers read own bookings" ON bookings;
DROP POLICY IF EXISTS "Allow customers create bookings" ON bookings;
DROP POLICY IF EXISTS "Allow managers manage at-home bookings" ON bookings;

CREATE POLICY "Allow customers read own bookings" ON bookings
  FOR SELECT 
  USING (customer_id = auth.uid());

CREATE POLICY "Allow customers create bookings" ON bookings
  FOR INSERT 
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Allow managers manage at-home bookings" ON bookings
  FOR ALL 
  USING (
    booking_type = 'AT_HOME' AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'MANAGER')
  )
  WITH CHECK (
    booking_type = 'AT_HOME' AND
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'MANAGER')
  );

-- Employees Policies (simplified - check manager_id in policy, not in DO block)
DROP POLICY IF EXISTS "Allow managers read employees" ON employees;
DROP POLICY IF EXISTS "Allow managers manage employees" ON employees;

-- Policy that works whether manager_id exists or not
CREATE POLICY "Allow managers read employees" ON employees
  FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'MANAGER')
    AND (
      NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'manager_id')
      OR manager_id = auth.uid()
    )
  );

CREATE POLICY "Allow managers manage employees" ON employees
  FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'MANAGER')
    AND (
      NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'manager_id')
      OR manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'MANAGER')
    AND (
      NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'manager_id')
      OR manager_id = auth.uid()
    )
  );

-- Addresses Policies
DROP POLICY IF EXISTS "Allow users manage own addresses" ON addresses;
CREATE POLICY "Allow users manage own addresses" ON addresses
  FOR ALL 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Payments Policies
DROP POLICY IF EXISTS "Allow users manage own payments" ON payments;
CREATE POLICY "Allow users manage own payments" ON payments
  FOR ALL 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Booking Items Policies
DROP POLICY IF EXISTS "Allow users manage booking items" ON booking_items;
CREATE POLICY "Allow users manage booking items" ON booking_items
  FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_items.booking_id AND bookings.customer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_items.booking_id AND bookings.customer_id = auth.uid())
  );

-- Booking Products Policies
DROP POLICY IF EXISTS "Allow users manage booking products" ON booking_products;
CREATE POLICY "Allow users manage booking products" ON booking_products
  FOR ALL 
  USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_products.booking_id AND bookings.customer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_products.booking_id AND bookings.customer_id = auth.uid())
  );

-- =====================================================
-- STEP 9: Create triggers for updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_addresses_updated_at ON addresses;
CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_booking_products_updated_at ON booking_products;
CREATE TRIGGER update_booking_products_updated_at
  BEFORE UPDATE ON booking_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION (uncomment to run)
-- =====================================================
-- SELECT COUNT(*) FROM service_catalog WHERE is_active = true;
-- SELECT COUNT(*) FROM product_catalog WHERE is_active = true;
-- SELECT COUNT(*) FROM bookings WHERE booking_type = 'AT_HOME' AND status = 'AWAITING_MANAGER';
-- SELECT COUNT(*) FROM employees WHERE role = 'BEAUTICIAN' AND status = 'ACTIVE';

