# 865 Elite Flag Football

Official website for 865 Elite Flag Football.

## About

This is the source code for the 865 Elite Flag Football website, hosted via GitHub Pages.

## Development

The site is a single-page static website contained in `index.html`. To preview changes locally, open `index.html` in a web browser.

## Supabase Backend Setup

League data (standings, schedule, player stats, playoff bracket, gallery, etc.) is synced to Supabase. To set up the database:

### 1. Create the `shared_state` table

Run the following SQL in your Supabase SQL Editor:

```sql
create table shared_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

insert into shared_state (id, data)
values ('v1', '{}')
on conflict (id) do nothing;

alter table shared_state enable row level security;

-- Anyone can read league data
create policy "public read"
on shared_state
for select
using (true);

-- Only authenticated admin emails can update
create policy "admin update"
on shared_state
for update
using (
  auth.jwt()->'email' in (
    'REPLACE_WITH_ADMIN_EMAIL_1',
    'REPLACE_WITH_ADMIN_EMAIL_2'
  )
)
with check (
  auth.jwt()->'email' in (
    'REPLACE_WITH_ADMIN_EMAIL_1',
    'REPLACE_WITH_ADMIN_EMAIL_2'
  )
);

-- Only authenticated admin emails can insert
create policy "admin insert"
on shared_state
for insert
with check (
  auth.jwt()->'email' in (
    'REPLACE_WITH_ADMIN_EMAIL_1',
    'REPLACE_WITH_ADMIN_EMAIL_2'
  )
);
```

Replace `REPLACE_WITH_ADMIN_EMAIL_1` and `REPLACE_WITH_ADMIN_EMAIL_2` with the actual admin email addresses registered in Supabase Auth.

### 2. Create admin users in Supabase Auth

In the Supabase dashboard, go to **Authentication → Users** and create accounts for each admin with their email and a password. Those emails must match the ones used in the RLS policies above.

### 3. Admin login with cloud sync

When admins log in to the site, they enter:
- Their **admin username** (TFick123 or Maxwell22339) — for local authentication
- Their **email** (optional, for cloud sync) — their Supabase Auth email
- Their **password** — used for both local auth and Supabase Auth

If the email field is filled in and the Supabase credentials are valid, data changes will be synced to the cloud automatically on each save. Public visitors always read the latest data from Supabase on page load.
