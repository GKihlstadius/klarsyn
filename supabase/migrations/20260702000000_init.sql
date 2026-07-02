-- Klarsyn: intervjusessioner och rapporter

create table if not exists sessions (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null,
  state jsonb not null,
  transcript jsonb not null
);

create table if not exists reports (
  session_id uuid primary key references sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  approved boolean not null default false,
  report jsonb not null
);

-- RLS pa: publika nyckeln kommer inte at nagot, servern anvander secret-nyckeln som gar forbi RLS.
alter table sessions enable row level security;
alter table reports enable row level security;
