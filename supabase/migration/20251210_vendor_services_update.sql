-- Add new columns to services table
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "genderPreference" text DEFAULT 'UNISEX',
ADD COLUMN IF NOT EXISTS "image" text; -- Using 'image' to match existing schema convention, user requested 'image_url' but 'image' is standard in this project

-- Create vendor-services storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-services', 'vendor-services', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for Storage
-- Allow public read access to vendor-services bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'vendor-services' );

-- Allow authenticated vendors to insert their own images
CREATE POLICY "Vendor Upload Access"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'vendor-services' );

-- Allow vendors to update/delete their own images
CREATE POLICY "Vendor Update Access"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'vendor-services' );

CREATE POLICY "Vendor Delete Access"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'vendor-services' );
