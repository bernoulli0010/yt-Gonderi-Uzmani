-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  token_balance integer default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Users can view own profile" 
on public.profiles for select 
using ( auth.uid() = id );

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
  insert into public.profiles (id, email, full_name, token_balance)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 5);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Posts table
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
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


