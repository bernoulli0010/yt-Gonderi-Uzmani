-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  token_balance integer default 5,
  role text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for Profiles
-- Anyone can view profiles (needed for forum user display)
create policy "Anyone can view profiles" 
on public.profiles for select 
using ( true );

create policy "Users can insert own profile" 
on public.profiles for insert 
with check ( auth.uid() = id );

create policy "Users can update own profile" 
on public.profiles for update 
using ( auth.uid() = id );

-- This trigger automatically creates a profile entry when a new user signs up
create function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, token_balance, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 5, 'user');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Posts table
create table public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  content text,
  meta_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Posts
alter table public.posts enable row level security;

create policy "Users can view own posts" 
on public.posts for select 
using ( auth.uid() = user_id );

create policy "Users can insert own posts" 
on public.posts for insert 
with check ( auth.uid() = user_id );

-- Token Purchases table (Shopier integration log)
create table public.token_purchases (
  id uuid default gen_random_uuid() primary key,
  shopier_order_id text unique not null,
  shopier_webhook_id text,
  user_id uuid references public.profiles(id),
  email text not null,
  tokens integer not null,
  amount text,
  currency text default 'TRY',
  status text not null default 'pending',
  error_message text,
  raw_payload jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Token Purchases
alter table public.token_purchases enable row level security;

-- Users can view their own purchase history
create policy "Users can view own purchases" 
on public.token_purchases for select 
using ( auth.uid() = user_id );

-- Service role can insert/update (no user-level insert policy needed)
-- The Edge Function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS


-- ═══════════════════════════════════════════════════════════════
-- FORUM SYSTEM TABLES
-- ═══════════════════════════════════════════════════════════════

-- NOTE: 'role' column already added to profiles CREATE TABLE above.
-- Values: 'user', 'moderator', 'admin'
-- To set admin manually: UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';
-- NOTE: profiles SELECT policy changed to "Anyone can view profiles" above (needed for forum).

-- If your database already exists and you need to migrate, run these manually:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';
-- DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
-- CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);

-- ── Forum Category Groups ──
create table public.forum_category_groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  sort_order integer default 0,
  is_collapsed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.forum_category_groups enable row level security;

create policy "Anyone can view forum groups"
  on public.forum_category_groups for select using (true);

create policy "Admin can insert forum groups"
  on public.forum_category_groups for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can update forum groups"
  on public.forum_category_groups for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can delete forum groups"
  on public.forum_category_groups for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── Forum Categories ──
create table public.forum_categories (
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

alter table public.forum_categories enable row level security;

create policy "Anyone can view forum categories"
  on public.forum_categories for select using (true);

create policy "Admin can insert forum categories"
  on public.forum_categories for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can update forum categories"
  on public.forum_categories for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can delete forum categories"
  on public.forum_categories for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── Forum Subcategories ──
create table public.forum_subcategories (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.forum_categories(id) on delete cascade not null,
  name text not null,
  sort_order integer default 0,
  thread_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.forum_subcategories enable row level security;

create policy "Anyone can view forum subcategories"
  on public.forum_subcategories for select using (true);

create policy "Admin can insert forum subcategories"
  on public.forum_subcategories for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can update forum subcategories"
  on public.forum_subcategories for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admin can delete forum subcategories"
  on public.forum_subcategories for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── Forum Threads ──
create table public.forum_threads (
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

alter table public.forum_threads enable row level security;

create policy "Anyone can view forum threads"
  on public.forum_threads for select using (true);

create policy "Auth users can insert forum threads"
  on public.forum_threads for insert
  with check (auth.uid() = user_id);

create policy "Owner or mod/admin can update forum threads"
  on public.forum_threads for update
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'))
  );

create policy "Owner or mod/admin can delete forum threads"
  on public.forum_threads for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'))
  );

-- ── Forum Replies ──
create table public.forum_replies (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.forum_threads(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  content text not null,
  parent_id uuid references public.forum_replies(id) on delete set null,
  like_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.forum_replies enable row level security;

create policy "Anyone can view forum replies"
  on public.forum_replies for select using (true);

create policy "Auth users can insert forum replies"
  on public.forum_replies for insert
  with check (auth.uid() = user_id);

create policy "Owner or mod/admin can update forum replies"
  on public.forum_replies for update
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'))
  );

create policy "Owner or mod/admin can delete forum replies"
  on public.forum_replies for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'admin'))
  );

-- ── Forum Likes ──
create table public.forum_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  thread_id uuid references public.forum_threads(id) on delete cascade,
  reply_id uuid references public.forum_replies(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_thread_like unique (user_id, thread_id),
  constraint unique_reply_like unique (user_id, reply_id),
  constraint like_target_check check (
    (thread_id is not null and reply_id is null)
    or (thread_id is null and reply_id is not null)
  )
);

alter table public.forum_likes enable row level security;

create policy "Anyone can view forum likes"
  on public.forum_likes for select using (true);

create policy "Auth users can insert forum likes"
  on public.forum_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own forum likes"
  on public.forum_likes for delete
  using (auth.uid() = user_id);

-- ── Forum Notifications ──
create table public.forum_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null, -- 'reply', 'like', 'mention'
  from_user_id uuid references public.profiles(id),
  from_user_name text,
  thread_id uuid references public.forum_threads(id) on delete cascade,
  thread_title text,
  reply_id uuid references public.forum_replies(id) on delete cascade,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.forum_notifications enable row level security;

create policy "Users can view own notifications"
  on public.forum_notifications for select
  using (auth.uid() = user_id);

create policy "Auth users can insert notifications"
  on public.forum_notifications for insert
  with check (true);

create policy "Users can update own notifications"
  on public.forum_notifications for update
  using (auth.uid() = user_id);

create policy "Users can delete own notifications"
  on public.forum_notifications for delete
  using (auth.uid() = user_id);

-- ── Indexes for performance ──
create index idx_forum_threads_category on public.forum_threads(category_id);
create index idx_forum_threads_subcategory on public.forum_threads(subcategory_id);
create index idx_forum_threads_user on public.forum_threads(user_id);
create index idx_forum_threads_created on public.forum_threads(created_at desc);
create index idx_forum_threads_pinned on public.forum_threads(is_pinned, created_at desc);
create index idx_forum_replies_thread on public.forum_replies(thread_id);
create index idx_forum_replies_user on public.forum_replies(user_id);
create index idx_forum_likes_thread on public.forum_likes(thread_id);
create index idx_forum_likes_reply on public.forum_likes(reply_id);
create index idx_forum_likes_user on public.forum_likes(user_id);
create index idx_forum_notifications_user on public.forum_notifications(user_id, is_read);
create index idx_forum_categories_group on public.forum_categories(group_id);
create index idx_forum_subcategories_category on public.forum_subcategories(category_id);


