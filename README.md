# GM06 Investment Club — Web Platform

Full-stack investment club management platform replacing the Excel workbook. Built with Next.js 14, Supabase, deployed on Vercel.

## What Members See

- **Personal dashboard** with live portfolio value calculated from current investment prices
- Portfolio growth chart, asset allocation breakdown, ownership percentage
- Recent contributions and outstanding fines
- Printable statement matching the official GM06 PDF format
- Password change in Settings

## What Admin (Treasurer) Sees

Everything members see, plus:
- **Club dashboard** — total portfolio, all members ranked by value
- **Record contributions** — single entry or batch-record all 15 members at once
- **Monthly valuation** — one-click snapshot that calculates every member's share
- **Investment CRUD** — add/edit holdings, update manual prices, auto-fetch crypto from Binance
- **Member management** — add members (auto-generates login), edit details, reset passwords
- **Fine management** — record with preset reasons, toggle paid/unpaid
- **Reports** — open all statements at once, download CSV exports (members, contributions, investments, arrears)
- **Settings** — USD/UGX exchange rate, statement date

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router, React, Tailwind CSS |
| Backend | Next.js API Routes (12 endpoints) |
| Database | Supabase PostgreSQL (8 tables) |
| Auth | JWT + bcrypt, role-based (admin/member) |
| Prices | Binance REST API, configurable UGX rate |
| Hosting | Vercel (free tier works) |

## Deploy in 5 Steps

### 1. Supabase

- Create free project at [supabase.com](https://supabase.com)
- Go to SQL Editor → paste contents of `supabase/schema.sql` → Run
- Go to Project Settings → API → copy URL, anon key, and service role key

### 2. GitHub

```bash
tar xzf gm06-app.tar.gz && cd gm06-app
git init && git add . && git commit -m "GM06 Investment Club"
# Create repo on github.com, then:
git remote add origin https://github.com/YOU/gm06-app.git
git push -u origin main
```

### 3. Vercel

- Import the repo at [vercel.com](https://vercel.com)
- Add environment variables:

| Variable | Value |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | your-project.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | your anon key |
| SUPABASE_SERVICE_ROLE_KEY | your service role key |
| JWT_SECRET | any random 64-char string |

- Deploy

### 4. Seed Data

```bash
cp .env.local.example .env.local   # fill in the values
npm install
node scripts/seed.js
```

### 5. Login

| User | Email | Password |
|---|---|---|
| Admin | arnold.kibuuka@gm06.club | gm06-1146 |
| Member | nicholas.kabonge@gm06.club | gm06-1340 |

All members: `firstname.lastname@gm06.club` / `gm06-{last 4 digits of phone}`

## Monthly Workflow

1. Members deposit money → admin records in **Contributions** (single or batch)
2. Admin clicks **Update Prices** in sidebar → crypto prices refresh from Binance
3. Admin updates manual prices (MTN, UAP) in **Admin → Investments**
4. Admin updates **UGX rate** in **Settings** if it changed
5. Admin goes to **Admin → Valuation** → picks date → **Generate**
6. Members log in → see updated dashboard with live valuation

## Project Structure

```
app/
├── (auth)/                    # Pages behind login
│   ├── dashboard/             # Role-aware: member vs admin view
│   ├── contributions/         # Record & view contributions
│   ├── portfolio/             # Club investments & allocation
│   ├── members/               # Admin: all members + statements
│   ├── reports/               # Statements, CSV exports
│   ├── admin/                 # Valuation, CRUD, fines
│   ├── settings/              # Password, UGX rate
│   └── statements/[id]/       # Print-friendly statement
├── api/
│   ├── auth/                  # Login/logout
│   ├── me/                    # Member's live valuation
│   ├── members/               # Member CRUD
│   ├── contributions/         # Contribution CRUD
│   ├── investments/           # Investment CRUD
│   ├── portfolio/             # Portfolio summary
│   ├── prices/                # Binance price update
│   ├── snapshots/             # Monthly valuation generator
│   ├── statements/            # Statement data
│   ├── fines/                 # Fine CRUD
│   ├── password/              # Password change/reset
│   ├── settings/              # Club settings
│   └── export/                # CSV downloads
├── login/                     # Login page
└── not-found.jsx              # 404 page

components/
├── AuthShell.jsx              # Layout + user context + mobile toggle
├── Sidebar.jsx                # Navigation (7 items + admin)
├── Charts.jsx                 # Donut, Sparkline, StatCard
├── Modal.jsx                  # Reusable modal + form helpers
└── Toast.jsx                  # Toast notifications

lib/
├── auth.js                    # JWT, bcrypt, session
├── supabase.js                # Database clients
├── valuation.js               # Real-time member valuation engine
├── prices.js                  # Binance API + dynamic UGX rate
└── format.js                  # Number/date formatters
```

## API Reference

| Endpoint | Methods | Auth | Purpose |
|---|---|---|---|
| /api/auth | POST, DELETE | Public | Login/logout |
| /api/me | GET | Member | Own live valuation + history |
| /api/members | GET, POST, PUT, DELETE | Admin* | Member CRUD |
| /api/contributions | GET, POST, DELETE | Admin* | Record contributions |
| /api/investments | GET, POST, PUT, DELETE | Admin | Investment CRUD |
| /api/portfolio | GET | Any | Portfolio summary |
| /api/prices | POST | Admin | Trigger Binance update |
| /api/snapshots | GET, POST | Admin | Monthly valuations |
| /api/statements | GET | Member* | Statement data |
| /api/fines | GET, POST, PUT | Admin* | Fine management |
| /api/password | PUT | Any | Change/reset password |
| /api/settings | GET, PUT | Admin** | Club settings |
| /api/export | GET | Admin | CSV downloads |

*Members can read their own data only. **GET is available to all.

## Database Tables

| Table | Purpose |
|---|---|
| members | User accounts with roles |
| contributions | Every deposit, fine, expense, withdrawal |
| investments | Club holdings with prices |
| price_history | Price snapshots for charts |
| portfolio_snapshots | Monthly club-level valuations |
| member_snapshots | Monthly per-member valuations |
| fines | Fine tracking with paid status |
| settings | Key-value config (UGX rate, etc.) |
