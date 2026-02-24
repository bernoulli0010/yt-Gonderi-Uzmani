-- ═══════════════════════════════════════════════════════════════
-- FORUM MIGRATION - Run this on existing database
-- ═══════════════════════════════════════════════════════════════

-- 1. Add role column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- 2. Update profiles SELECT policy (allow everyone to read profiles for forum)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);

-- 3. Forum Category Groups
CREATE TABLE IF NOT EXISTS public.forum_category_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sort_order integer default 0,
  is_collapsed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.forum_category_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum groups" ON public.forum_category_groups;
CREATE POLICY "Anyone can view forum groups"
  ON public.forum_category_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can insert forum groups" ON public.forum_category_groups;
CREATE POLICY "Admin can insert forum groups"
  ON public.forum_category_groups FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can update forum groups" ON public.forum_category_groups;
CREATE POLICY "Admin can update forum groups"
  ON public.forum_category_groups FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can delete forum groups" ON public.forum_category_groups;
CREATE POLICY "Admin can delete forum groups"
  ON public.forum_category_groups FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Forum Categories
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.forum_category_groups(id) on delete cascade not null,
  name text not null,
  description text,
  icon text default '💬',
  sort_order integer default 0,
  thread_count integer default 0,
  reply_count integer default 0,
  last_thread_id uuid,
  last_thread_title text,
  last_reply_user text,
  last_reply_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum categories" ON public.forum_categories;
CREATE POLICY "Anyone can view forum categories"
  ON public.forum_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can insert forum categories" ON public.forum_categories;
CREATE POLICY "Admin can insert forum categories"
  ON public.forum_categories FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can update forum categories" ON public.forum_categories;
CREATE POLICY "Admin can update forum categories"
  ON public.forum_categories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can delete forum categories" ON public.forum_categories;
CREATE POLICY "Admin can delete forum categories"
  ON public.forum_categories FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 5. Forum Subcategories
CREATE TABLE IF NOT EXISTS public.forum_subcategories (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.forum_categories(id) on delete cascade not null,
  name text not null,
  sort_order integer default 0,
  thread_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.forum_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum subcategories" ON public.forum_subcategories;
CREATE POLICY "Anyone can view forum subcategories"
  ON public.forum_subcategories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can insert forum subcategories" ON public.forum_subcategories;
CREATE POLICY "Admin can insert forum subcategories"
  ON public.forum_subcategories FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can update forum subcategories" ON public.forum_subcategories;
CREATE POLICY "Admin can update forum subcategories"
  ON public.forum_subcategories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can delete forum subcategories" ON public.forum_subcategories;
CREATE POLICY "Admin can delete forum subcategories"
  ON public.forum_subcategories FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 6. Forum Threads
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.forum_categories(id) on delete cascade not null,
  subcategory_id uuid references public.forum_subcategories(id) on delete set null,
  user_id uuid references public.profiles(id) not null,
  title text not null,
  content text not null,
  tags text[] default '{}',
  is_pinned boolean default false,
  is_locked boolean default false,
  view_count integer default 0,
  reply_count integer default 0,
  like_count integer default 0,
  last_reply_user text,
  last_reply_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum threads" ON public.forum_threads;
CREATE POLICY "Anyone can view forum threads"
  ON public.forum_threads FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert forum threads" ON public.forum_threads;
CREATE POLICY "Auth users can insert forum threads"
  ON public.forum_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner or mod/admin can update forum threads" ON public.forum_threads;
CREATE POLICY "Owner or mod/admin can update forum threads"
  ON public.forum_threads FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

DROP POLICY IF EXISTS "Owner or mod/admin can delete forum threads" ON public.forum_threads;
CREATE POLICY "Owner or mod/admin can delete forum threads"
  ON public.forum_threads FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- 7. Forum Replies
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.forum_threads(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  content text not null,
  parent_id uuid references public.forum_replies(id) on delete set null,
  like_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum replies" ON public.forum_replies;
CREATE POLICY "Anyone can view forum replies"
  ON public.forum_replies FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert forum replies" ON public.forum_replies;
CREATE POLICY "Auth users can insert forum replies"
  ON public.forum_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner or mod/admin can update forum replies" ON public.forum_replies;
CREATE POLICY "Owner or mod/admin can update forum replies"
  ON public.forum_replies FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

DROP POLICY IF EXISTS "Owner or mod/admin can delete forum replies" ON public.forum_replies;
CREATE POLICY "Owner or mod/admin can delete forum replies"
  ON public.forum_replies FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('moderator', 'admin'))
  );

-- 8. Forum Likes
CREATE TABLE IF NOT EXISTS public.forum_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  thread_id uuid references public.forum_threads(id) on delete cascade,
  reply_id uuid references public.forum_replies(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  CONSTRAINT unique_thread_like UNIQUE (user_id, thread_id),
  CONSTRAINT unique_reply_like UNIQUE (user_id, reply_id),
  CONSTRAINT like_target_check CHECK (
    (thread_id IS NOT NULL AND reply_id IS NULL)
    OR (thread_id IS NULL AND reply_id IS NOT NULL)
  )
);

ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum likes" ON public.forum_likes;
CREATE POLICY "Anyone can view forum likes"
  ON public.forum_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth users can insert forum likes" ON public.forum_likes;
CREATE POLICY "Auth users can insert forum likes"
  ON public.forum_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own forum likes" ON public.forum_likes;
CREATE POLICY "Users can delete own forum likes"
  ON public.forum_likes FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Forum Notifications
CREATE TABLE IF NOT EXISTS public.forum_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  from_user_id uuid references public.profiles(id),
  from_user_name text,
  thread_id uuid references public.forum_threads(id) on delete cascade,
  thread_title text,
  reply_id uuid references public.forum_replies(id) on delete cascade,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.forum_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.forum_notifications;
CREATE POLICY "Users can view own notifications"
  ON public.forum_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Auth users can insert notifications" ON public.forum_notifications;
CREATE POLICY "Auth users can insert notifications"
  ON public.forum_notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.forum_notifications;
CREATE POLICY "Users can update own notifications"
  ON public.forum_notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.forum_notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.forum_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON public.forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_subcategory ON public.forum_threads(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_user ON public.forum_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_created ON public.forum_threads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_threads_pinned ON public.forum_threads(is_pinned, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_replies_thread ON public.forum_replies(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_replies_user ON public.forum_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_thread ON public.forum_likes(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_reply ON public.forum_likes(reply_id);
CREATE INDEX IF NOT EXISTS idx_forum_likes_user ON public.forum_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_notifications_user ON public.forum_notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_forum_categories_group ON public.forum_categories(group_id);
CREATE INDEX IF NOT EXISTS idx_forum_subcategories_category ON public.forum_subcategories(category_id);
