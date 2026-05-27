# 865 Elite Flag Football

Official website for 865 Elite Flag Football.

## About

This is the source code for the 865 Elite Flag Football website, hosted via GitHub Pages.

## Development

The site is a single-page static website contained in `index.html`. To preview changes locally, open `index.html` in a web browser.

## Supabase setup for persistent gallery uploads

Gallery images now persist in Supabase Storage and metadata is stored in a Supabase table row.

### 1) Configure client credentials

In `index.html`, set `window.__865EliteSupabaseConfig`:

```html
window.__865EliteSupabaseConfig = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY',
  dataTable: 'league_site_data',
  galleryKey: 'gallery'
};
```

### 2) Run exact SQL in Supabase SQL Editor

The SQL below is safe to re-run.

```sql
-- Table used for shared league/site JSON state
create table if not exists public.league_site_data (
  key text primary key,
  value jsonb not null default '[]'::jsonb
);

alter table public.league_site_data enable row level security;

-- Gallery metadata row policies
drop policy if exists "gallery select" on public.league_site_data;
create policy "gallery select"
on public.league_site_data
for select
to anon, authenticated
using (key = 'gallery');

drop policy if exists "gallery insert" on public.league_site_data;
create policy "gallery insert"
on public.league_site_data
for insert
to anon, authenticated
with check (key = 'gallery');

drop policy if exists "gallery update" on public.league_site_data;
create policy "gallery update"
on public.league_site_data
for update
to anon, authenticated
using (key = 'gallery')
with check (key = 'gallery');

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('gallery-images', 'gallery-images', true)
on conflict (id) do update set public = excluded.public;

-- Storage object policies for gallery-images bucket
drop policy if exists "gallery images public read" on storage.objects;
create policy "gallery images public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'gallery-images');

drop policy if exists "gallery images upload" on storage.objects;
create policy "gallery images upload"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'gallery-images');

drop policy if exists "gallery images delete" on storage.objects;
create policy "gallery images delete"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'gallery-images');
```

### 3) Verification checklist

1. Sign in as admin and upload one or more photos in Gallery.
2. Confirm photos appear immediately.
3. Clear browser site data (localStorage/IndexedDB/cache) and reload.
4. Confirm gallery photos still appear (loaded from Supabase URL metadata).
5. Open the site on a second device/browser and confirm the same photos appear.
