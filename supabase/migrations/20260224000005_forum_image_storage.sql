-- ═══════════════════════════════════════════════════════════════
-- FORUM IMAGE STORAGE - Bucket and policies
-- ═══════════════════════════════════════════════════════════════

-- Create public bucket for forum images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forum-images',
  'forum-images',
  true,
  2097152, -- 2MB max
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view forum images (public bucket)
CREATE POLICY "Anyone can view forum images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'forum-images');

-- Only authenticated users can upload
CREATE POLICY "Auth users can upload forum images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'forum-images'
    AND auth.uid() IS NOT NULL
  );

-- Users can delete their own uploads (filename starts with their uid)
CREATE POLICY "Users can delete own forum images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'forum-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
