# 865 Elite Flag Football

Official website for 865 Elite Flag Football.

## About

This is the source code for the 865 Elite Flag Football website, hosted via GitHub Pages.

## Development

The site is a single-page static website contained in `index.html`. To preview changes locally, open `index.html` in a web browser.

## Supabase setup for shared production data

Production data now reads from and writes to Supabase as the single source of truth.

### 1) Configure one shared client config

In `index.html`, set `window.__865EliteSupabaseConfig` once and keep the same URL + anon key everywhere:

```html
window.__865EliteSupabaseConfig = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
  stateTable: 'league_site_data',
  registrationsTable: 'registrations',
  galleryImagesTable: 'gallery_images',
  galleryBucket: 'gallery-images'
};
```

### 2) Run this SQL in Supabase

```sql
create table if not exists public.league_site_data (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

create table if not exists public.registrations (
  id text primary key,
  name text not null default '',
  email text not null default '',
  type text not null default 'team',
  method text not null default 'paypal',
  team_name text not null default '',
  team_members text not null default '',
  team_years text not null default '',
  off_position text not null default '',
  def_position text not null default '',
  experience text not null default '',
  payment_username text not null default '',
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.gallery_images (
  id text primary key,
  storage_path text not null,
  public_url text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

alter table public.league_site_data enable row level security;
alter table public.registrations enable row level security;
alter table public.gallery_images enable row level security;

-- shared public state
drop policy if exists "league site data select" on public.league_site_data;
create policy "league site data select"
on public.league_site_data
for select
to anon, authenticated
using (true);

drop policy if exists "league site data insert" on public.league_site_data;
create policy "league site data insert"
on public.league_site_data
for insert
to anon, authenticated
with check (true);

drop policy if exists "league site data update" on public.league_site_data;
create policy "league site data update"
on public.league_site_data
for update
to anon, authenticated
using (true)
with check (true);

-- signup rows
drop policy if exists "registrations select" on public.registrations;
create policy "registrations select"
on public.registrations
for select
to anon, authenticated
using (true);

drop policy if exists "registrations insert" on public.registrations;
create policy "registrations insert"
on public.registrations
for insert
to anon, authenticated
with check (true);

drop policy if exists "registrations update" on public.registrations;
create policy "registrations update"
on public.registrations
for update
to anon, authenticated
using (true)
with check (true);

-- gallery rows
drop policy if exists "gallery images table select" on public.gallery_images;
create policy "gallery images table select"
on public.gallery_images
for select
to anon, authenticated
using (true);

drop policy if exists "gallery images table insert" on public.gallery_images;
create policy "gallery images table insert"
on public.gallery_images
for insert
to anon, authenticated
with check (true);

drop policy if exists "gallery images table update" on public.gallery_images;
create policy "gallery images table update"
on public.gallery_images
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "gallery images table delete" on public.gallery_images;
create policy "gallery images table delete"
on public.gallery_images
for delete
to anon, authenticated
using (true);

-- storage bucket
insert into storage.buckets (id, name, public)
values ('gallery-images', 'gallery-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "gallery bucket select" on storage.objects;
create policy "gallery bucket select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'gallery-images');

drop policy if exists "gallery bucket insert" on storage.objects;
create policy "gallery bucket insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'gallery-images');

drop policy if exists "gallery bucket delete" on storage.objects;
create policy "gallery bucket delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'gallery-images');
```

### 3) Expected production behavior

- Signup submissions `INSERT` into `public.registrations`
- Signup admin list/count `SELECT` from `public.registrations` on page load
- Gallery uploads store files in Supabase Storage and metadata rows in `public.gallery_images`
- Gallery display `SELECT`s from `public.gallery_images` on page load
- Admin content/settings updates `INSERT` or `UPDATE` rows in `public.league_site_data`
- Production pages should not depend on browser-only localStorage/sessionStorage for shared public data
- Console should show Supabase client initialization plus `SELECT` / `INSERT` success or error messages and row counts

### 4) Verification checklist

1. Deploy the updated code to GitHub Pages.
2. Open the live site in Edge and create a signup or gallery item.
3. Open the same live URL in Safari private mode and refresh.
4. Confirm the same item appears there.
5. Add another item in Safari and confirm it appears in Edge after refresh.
