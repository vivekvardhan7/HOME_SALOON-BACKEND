
-- 1. Fix Missing Columns in Beauticians Table
ALTER TABLE beauticians ADD COLUMN IF NOT EXISTS expert_level TEXT DEFAULT 'Intermediate';
ALTER TABLE beauticians ADD COLUMN IF NOT EXISTS skills TEXT;
ALTER TABLE beauticians ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE beauticians ADD COLUMN IF NOT EXISTS current_latitude FLOAT;
ALTER TABLE beauticians ADD COLUMN IF NOT EXISTS current_longitude FLOAT;
ALTER TABLE beauticians ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- 2. Ensure Availability Table Exists (Previous script might have skipped it if beauticians existed)
CREATE TABLE IF NOT EXISTS beauticians_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beautician_id UUID REFERENCES beauticians(id) ON DELETE CASCADE,
    day_of_week INTEGER, -- 0=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Ensure Booking Columns Exist
ALTER TABLE athome_booking_services 
ADD COLUMN IF NOT EXISTS assigned_beautician_id UUID REFERENCES beauticians(id);

ALTER TABLE athome_booking_products 
ADD COLUMN IF NOT EXISTS assigned_beautician_id UUID REFERENCES beauticians(id);

ALTER TABLE athome_bookings 
ADD COLUMN IF NOT EXISTS assigned_beautician_id UUID REFERENCES beauticians(id);

-- 4. Notify Supabase to Reload Schema Cache
NOTIFY pgrst, 'reload config';
