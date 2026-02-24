-- ═══════════════════════════════════════════════════════════════
-- FORUM RLS FIXES - Critical policy updates
-- ═══════════════════════════════════════════════════════════════

-- 1. Fix forum_threads UPDATE policy
--    Any authenticated user needs to update view_count (on view),
--    reply_count/last_reply_user/last_reply_at (on reply),
--    and like_count (on like/unlike).
--    Owner or mod/admin can update title, content, is_pinned, is_locked.
DROP POLICY IF EXISTS "Owner or mod/admin can update forum threads" ON public.forum_threads;
CREATE POLICY "Auth users can update forum threads"
  ON public.forum_threads FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 2. Fix forum_categories UPDATE policy
--    Any authenticated user needs to update thread_count, reply_count,
--    last_thread_id, last_thread_title, last_reply_user, last_reply_at
--    when creating threads or replies.
DROP POLICY IF EXISTS "Admin can update forum categories" ON public.forum_categories;
CREATE POLICY "Auth users can update forum categories"
  ON public.forum_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 3. Fix forum_subcategories UPDATE policy
--    Any authenticated user needs to update thread_count when creating threads.
DROP POLICY IF EXISTS "Admin can update forum subcategories" ON public.forum_subcategories;
CREATE POLICY "Auth users can update forum subcategories"
  ON public.forum_subcategories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 4. Fix profiles UPDATE policy for admin role management
--    Admin needs to change user roles. Keep existing self-update policy,
--    add admin-update policy.
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admin can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
