-- User profiles — captures resident info after first login
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  program text,
  specialty text,
  year_of_training int,
  site text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;

create policy "Users read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "Users update own profile"
  on profiles for update using (auth.uid() = id);

-- Service role access for pipeline (to include resident name in emails)
create policy "Service role full access profiles"
  on profiles for all using (auth.role() = 'service_role');

-- Updated_at trigger
create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
