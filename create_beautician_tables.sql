
-- 1. Beauticians Table (Admin Managed)
CREATE TABLE IF NOT EXISTS beauticians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    skills TEXT, -- Comma separated or description for ILIKE matching
    expert_level TEXT DEFAULT 'Intermediate', -- Junior, Intermediate, Senior
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    profile_image TEXT,
    current_latitude FLOAT,
    current_longitude FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Beautician Availability
CREATE TABLE IF NOT EXISTS beauticians_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beautician_id UUID REFERENCES beauticians(id) ON DELETE CASCADE,
    day_of_week INTEGER, -- 0=Sunday, 1=Monday...
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Live Tracking Updates
CREATE TABLE IF NOT EXISTS booking_live_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL, -- Link to athome_bookings
    beautician_id UUID REFERENCES beauticians(id),
    status TEXT NOT NULL, -- ON_WAY, ARRIVED, STARTED, COMPLETED
    latitude FLOAT,
    longitude FLOAT,
    customer_visible BOOLEAN DEFAULT TRUE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS beautician_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beautician_id UUID REFERENCES beauticians(id) ON DELETE CASCADE,
    booking_id UUID,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Update Bookings Table to support Beautician Assignment
-- We need to add 'beautician_id' to athome_bookings or services
-- Since logic is "Manager assigns beautician directly", implying per-booking or per-service?
-- User said: "Manager assigns beautician directly." likely to the whole booking if it's one person, 
-- but booking can have multiple services. Phase 2 usually implies per-service assignment, but "Vendor logic completely removed"
-- might simplify to one beautician per booking? 
-- Let's add it to `athome_booking_services` as `assigned_beautician_id` to be safe/granular.

ALTER TABLE athome_booking_services 
ADD COLUMN IF NOT EXISTS assigned_beautician_id UUID REFERENCES beauticians(id);

ALTER TABLE athome_booking_products 
ADD COLUMN IF NOT EXISTS assigned_beautician_id UUID REFERENCES beauticians(id); -- Maybe they bring products?

-- Also add to main booking for easier "Who is doing this?"
ALTER TABLE athome_bookings 
ADD COLUMN IF NOT EXISTS assigned_beautician_id UUID REFERENCES beauticians(id);

