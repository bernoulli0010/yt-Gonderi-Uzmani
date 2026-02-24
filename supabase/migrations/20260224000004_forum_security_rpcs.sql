-- ═══════════════════════════════════════════════════════════════
-- FORUM FINAL FIX - Secure RPC functions for counter updates
-- + Restore restrictive UPDATE policies
-- + Fix notification impersonation
-- ═══════════════════════════════════════════════════════════════

-- 1. RPC: Increment thread view count (any user, even guest via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.forum_increment_view(p_thread_id uuid)
RETURNS void AS $$
  UPDATE public.forum_threads SET view_count = view_count + 1 WHERE id = p_thread_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. RPC: Update thread reply info (called after inserting a reply)
CREATE OR REPLACE FUNCTION public.forum_on_reply(p_thread_id uuid, p_user_name text)
RETURNS void AS $$
  UPDATE public.forum_threads
  SET reply_count = reply_count + 1,
      last_reply_user = p_user_name,
      last_reply_at = now()
  WHERE id = p_thread_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. RPC: Update thread like count
CREATE OR REPLACE FUNCTION public.forum_update_thread_likes(p_thread_id uuid, p_delta int)
RETURNS void AS $$
  UPDATE public.forum_threads SET like_count = GREATEST(0, like_count + p_delta) WHERE id = p_thread_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4. RPC: Update reply like count
CREATE OR REPLACE FUNCTION public.forum_update_reply_likes(p_reply_id uuid, p_delta int)
RETURNS void AS $$
  UPDATE public.forum_replies SET like_count = GREATEST(0, like_count + p_delta) WHERE id = p_reply_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 5. RPC: Update category stats after new thread
CREATE OR REPLACE FUNCTION public.forum_on_new_thread(p_category_id uuid, p_thread_id uuid, p_title text, p_user_name text)
RETURNS void AS $$
  UPDATE public.forum_categories
  SET thread_count = thread_count + 1,
      last_thread_id = p_thread_id,
      last_thread_title = p_title,
      last_reply_user = p_user_name,
      last_reply_at = now()
  WHERE id = p_category_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 6. RPC: Update category reply count
CREATE OR REPLACE FUNCTION public.forum_on_category_reply(p_category_id uuid, p_user_name text)
RETURNS void AS $$
  UPDATE public.forum_categories
  SET reply_count = reply_count + 1,
      last_reply_user = p_user_name,
      last_reply_at = now()
  WHERE id = p_category_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 7. RPC: Decrement category counters on thread delete
CREATE OR REPLACE FUNCTION public.forum_on_thread_delete(p_category_id uuid, p_reply_count int)
RETURNS void AS $$
  UPDATE public.forum_categories
  SET thread_count = GREATEST(0, thread_count - 1),
      reply_count = GREATEST(0, reply_count - p_reply_count)
  WHERE id = p_category_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 8. RPC: Decrement thread reply count on reply delete
CREATE OR REPLACE FUNCTION public.forum_on_reply_delete(p_thread_id uuid)
RETURNS void AS $$
  UPDATE public.forum_threads SET reply_count = GREATEST(0, reply_count - 1) WHERE id = p_thread_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 9. RPC: Decrement category reply count on reply delete
CREATE OR REPLACE FUNCTION public.forum_on_cat_reply_delete(p_category_id uuid)
RETURNS void AS $$
  UPDATE public.forum_categories SET reply_count = GREATEST(0, reply_count - 1) WHERE id = p_category_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- 10. RPC: Increment subcategory thread count
CREATE OR REPLACE FUNCTION public.forum_inc_sub_threads(p_sub_id uuid)
RETURNS void AS $$
  UPDATE public.forum_subcategories SET thread_count = thread_count + 1 WHERE id = p_sub_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ═══ RESTORE RESTRICTIVE UPDATE POLICIES ═══

-- forum_threads: only owner or mod/admin can update content/pin/lock
DROP POLICY IF EXISTS "Auth users can update forum threads" ON public.forum_threads;
CREATE POLICY "Owner or mod/admin can update forum threads"
  ON public.forum_threads FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- forum_replies: only owner or mod/admin can update content
DROP POLICY IF EXISTS "Auth users can update forum replies" ON public.forum_replies;
CREATE POLICY "Owner or mod/admin can update forum replies"
  ON public.forum_replies FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- forum_categories: only admin can update
DROP POLICY IF EXISTS "Auth users can update forum categories" ON public.forum_categories;
CREATE POLICY "Admin can update forum categories"
  ON public.forum_categories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- forum_subcategories: only admin can update
DROP POLICY IF EXISTS "Auth users can update forum subcategories" ON public.forum_subcategories;
CREATE POLICY "Admin can update forum subcategories"
  ON public.forum_subcategories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ═══ FIX NOTIFICATION IMPERSONATION ═══
DROP POLICY IF EXISTS "Auth users can insert notifications" ON public.forum_notifications;
CREATE POLICY "Auth users can insert own notifications"
  ON public.forum_notifications FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);
