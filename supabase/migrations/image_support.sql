-- Image support for timeline_events
-- Run this in Supabase SQL Editor

-- 1. Add image_url column
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create storage bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('event-images', 'event-images', true, 5242880)  -- 5MB limit
ON CONFLICT (id) DO NOTHING;

-- 3. Allow public read on event-images
CREATE POLICY "Public read event-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- 4. Allow authenticated inserts
CREATE POLICY "Anyone insert event-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-images');
