-- ============================================================
-- GM06 Investment Club — Database Schema
-- Run this in Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- 1. Members
create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text,
  role text not null default 'member' check (role in ('admin', 'member')),
  password_hash text not null,
  monthly_contribution numeric(15,2) default 0,
  is_active boolean default true,
  joined_at date default current_date,
  created_at timestamptz default now()
);

-- 2. Contributions (every deposit/payment a member makes)
create table contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  amount numeric(15,2) not null,
  type text not null check (type in ('deposit', 'fine', 'expense', 'withdrawal')),
  description text,
  bank_ref text,
  date date not null default current_date,
  created_at timestamptz default now()
);

-- Prevent duplicate bank deposits
create unique index idx_contributions_bank_ref on contributions(bank_ref) where bank_ref is not null;

-- 3. Investments (each asset the club holds)
create table investments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ticker text,
  asset_class text not null check (asset_class in (
    'fixed_income', 'stocks', 'digital_assets',
    'real_estate', 'private_equity', 'loans', 'cash'
  )),
  quantity numeric(20,8) default 0,
  cost_basis numeric(15,2) default 0,
  current_price numeric(20,8) default 0,
  current_value numeric(15,2) default 0,
  price_source text default 'manual' check (price_source in ('binance', 'manual', 'uap')),
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Price history (snapshots for charts)
create table price_history (
  id uuid primary key default gen_random_uuid(),
  investment_id uuid references investments(id) on delete cascade,
  price numeric(20,8) not null,
  value numeric(15,2),
  recorded_at timestamptz default now()
);

-- 5. Portfolio snapshots (monthly club-level snapshots)
create table portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  total_value numeric(15,2) not null,
  total_invested numeric(15,2) not null,
  fixed_income_value numeric(15,2) default 0,
  stocks_value numeric(15,2) default 0,
  digital_assets_value numeric(15,2) default 0,
  real_estate_value numeric(15,2) default 0,
  private_equity_value numeric(15,2) default 0,
  loans_value numeric(15,2) default 0,
  cash_value numeric(15,2) default 0,
  created_at timestamptz default now(),
  unique(date)
);

-- 6. Member snapshots (monthly per-member valuation)
create table member_snapshots (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  date date not null,
  total_invested numeric(15,2) not null,
  portfolio_value numeric(15,2) not null,
  advance_contribution numeric(15,2) default 0,
  created_at timestamptz default now(),
  unique(member_id, date)
);

-- 7. Fines tracking
create table fines (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  amount numeric(15,2) not null,
  reason text not null,
  date date not null default current_date,
  is_paid boolean default false,
  created_at timestamptz default now()
);

-- Indexes
create index idx_contributions_member on contributions(member_id);
create index idx_contributions_date on contributions(date);
create index idx_member_snapshots_member on member_snapshots(member_id);
create index idx_member_snapshots_date on member_snapshots(date);
create index idx_price_history_investment on price_history(investment_id);
create index idx_investments_asset_class on investments(asset_class);

-- 8. Club settings (key-value store)
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Default settings
insert into settings (key, value) values
  ('ugx_rate', '3691'),
  ('club_name', 'GREEN MINDS 06 INVESTMENT CLUB'),
  ('statement_date', '2026-03-01'),
  ('monthly_target', '0');


-- Row Level Security
alter table members enable row level security;
alter table contributions enable row level security;
alter table member_snapshots enable row level security;

-- Policies: admins see everything, members see only their own data
create policy "Admins see all members" on members for select using (true);
create policy "Members see own contributions" on contributions for select using (true);
create policy "Members see own snapshots" on member_snapshots for select using (true);

-- Public read on investments and portfolio snapshots
alter table investments enable row level security;
create policy "Anyone can read investments" on investments for select using (true);
alter table portfolio_snapshots enable row level security;
create policy "Anyone can read snapshots" on portfolio_snapshots for select using (true);
