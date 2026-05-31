# 865 Elite Flag Football

Official website source for 865 Elite Flag Football.

## About

This repository contains the static site for the league website, hosted with GitHub Pages.

## Development

- Main markup: `index.html`
- Main styles: `styles.css`
- Main behavior: `script.js`
- Local preview: open `index.html` in a browser

## Static branding note

The repository no longer ships bundled static logo or background image files for the site shell. By default the header branding, footer branding, and hero background use text and CSS only, but admins can upload a custom logo and home background that persist through the shared site state. Dynamic user-managed content such as gallery items and team logos remains data-driven.

## Supabase setup for shared production data

Production data now reads from and writes to Supabase as the single source of truth.

### 1) Configure one shared client config

In `index.html`, set `window.__865EliteSupabaseConfig` once and keep the same URL + anon key everywhere:

```html
window.__865EliteSupabaseConfig = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
  stateTable: 'site_content',
  registrationsTable: 'signup_submissions',
  galleryImagesTable: 'gallery_images',
  galleryBucket: 'gallery-images'
};
```

### 2) Run this SQL in Supabase

```sql
create table if not exists public.site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

create table if not exists public.signup_submissions (
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
  football_experience text not null default '',
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

alter table public.site_content enable row level security;
alter table public.signup_submissions enable row level security;
alter table public.gallery_images enable row level security;

-- shared public state
-- NOTE: The frontend admin login uses the anon key (not Supabase Auth), so
-- INSERT/UPDATE policies must allow the `anon` role. Otherwise all admin saves
-- (logo, page content, standings, etc.) fail silently and revert on page reload.
drop policy if exists "site content select" on public.site_content;
create policy "site content select"
on public.site_content
for select
to anon, authenticated
using (true);

drop policy if exists "site content insert" on public.site_content;
create policy "site content insert"
on public.site_content
for insert
to anon, authenticated
with check (true);

drop policy if exists "site content update" on public.site_content;
create policy "site content update"
on public.site_content
for update
to anon, authenticated
using (true)
with check (true);

-- signup rows
drop policy if exists "signup submissions select" on public.signup_submissions;
create policy "signup submissions select"
on public.signup_submissions
for select
to anon, authenticated
using (true);

drop policy if exists "signup submissions insert" on public.signup_submissions;
create policy "signup submissions insert"
on public.signup_submissions
for insert
to anon, authenticated
with check (true);

drop policy if exists "signup submissions update" on public.signup_submissions;
create policy "signup submissions update"
on public.signup_submissions
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

- Signup submissions `INSERT` into `public.signup_submissions`
- Signup admin list/count `SELECT` from `public.signup_submissions` on page load
- Gallery uploads store files in Supabase Storage and metadata rows in `public.gallery_images`
- Gallery display `SELECT`s from `public.gallery_images` on page load
- Admin content/settings updates `INSERT` or `UPDATE` rows in `public.site_content`
- Production pages should not depend on browser-only localStorage/sessionStorage for shared public data
- Console should show Supabase client initialization plus `SELECT` / `INSERT` success or error messages and row counts

### 4) Verification checklist

1. Deploy the updated code to GitHub Pages.
2. Open the live site in Edge and create a signup or gallery item.
3. Open the same live URL in Safari private mode and refresh.
4. Confirm the same item appears there.
5. Add another item in Safari and confirm it appears in Edge after refresh.
