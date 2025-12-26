-- Create system_credentials table for Manager (System Role)
CREATE TABLE IF NOT EXISTS public.system_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(20) UNIQUE NOT NULL, -- 'MANAGER' - Unique constraint ensures only one manager
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT now()
);

-- Ensure only one MANAGER row exists (Though UNIQUE constraint on role does this, good to be explicit in triggers/logic if needed, but UNIQUE is enough).
-- The prompt explicitly says "Only ONE ROW allowed where role = 'MANAGER'". The UNIQUE(role) constraint handles this perfectly.

-- Insert a default manager if not exists (Only for initial setup to avoid lockout)
-- NOTE: We must hash the password 'manager123' (just a default placeholder).
-- In reality, we'll let the Admin set this via the dashboard properly.
-- For now, I'll insert a placeholder if it doesn't exist.
-- $2a$10$X7... is a bcrypt hash. I'll use a known hash for 'password' or similar for testing?
-- Let's just create the table. The application logic handles the content.

COMMENT ON TABLE public.system_credentials IS 'Stores system role credentials (e.g., MANAGER) separate from users table.';
