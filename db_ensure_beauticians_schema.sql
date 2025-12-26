-- Ensure beauticians table has necessary columns for the new features
-- This script is idempotent (safe to run multiple times)

CREATE TABLE IF NOT EXISTS public.beauticians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    skills TEXT[],  -- Array of strings for skills
    expert_level TEXT DEFAULT 'Intermediate', -- Junior, Intermediate, Senior
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, FROZEN
    profile_image TEXT,
    created_by_admin UUID REFERENCES auth.users(id),
    total_commission_paid NUMERIC DEFAULT 0,
    total_earnings NUMERIC DEFAULT 0
);

-- Add columns if they don't exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beauticians' AND column_name = 'expert_level') THEN
        ALTER TABLE public.beauticians ADD COLUMN expert_level TEXT DEFAULT 'Intermediate';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beauticians' AND column_name = 'status') THEN
        ALTER TABLE public.beauticians ADD COLUMN status TEXT DEFAULT 'ACTIVE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'beauticians' AND column_name = 'skills') THEN
        ALTER TABLE public.beauticians ADD COLUMN skills TEXT[];
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.beauticians ENABLE ROW LEVEL SECURITY;

-- Policies (Adjust as needed)
CREATE POLICY "Admins can view all beauticians" ON public.beauticians FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Admins can insert beauticians" ON public.beauticians FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Admins can update beauticians" ON public.beauticians FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);

CREATE POLICY "Admins can delete beauticians" ON public.beauticians FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN')
);
