#!/usr/bin/env node

// scripts/seed.js
// Usage: node scripts/seed.js
// Populates the database with current GM06 Investment Club data
//
// Prerequisites:
//   npm install
//   Copy .env.local.example to .env.local and fill in Supabase credentials

const path = require("path");

// Load .env.local
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });
} catch {
  console.log("Note: dotenv not found, relying on environment variables");
}

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("ERROR: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

const MEMBERS = [
  { name: "ARNOLD KIBUUKA", phone: "256772121146", invested: 6785000, value: 10837005.3, monthly: 0, advance: -5109500, role: "admin" },
  { name: "CLAIRE NANYONGA", phone: "256773244932", invested: 6480000, value: 10349859.1, monthly: 0, advance: -5445000 },
  { name: "CLAIRE BESIGYE", phone: "256773295373", invested: 11850000, value: 18926825.7, monthly: 600000, advance: 420000 },
  { name: "EDWIN MUREZI", phone: "256774483950", invested: 9800000, value: 15652564.7, monthly: 0, advance: -1793000 },
  { name: "ELIZA NAHAYO WANDERA", phone: "256788429562", invested: 14790000, value: 23622595.1, monthly: 0, advance: 3360000 },
  { name: "ELIZABETH NAKACHWA", phone: "256786207554", invested: 10270000, value: 16403249.0, monthly: 0, advance: -1276000 },
  { name: "EMMANUEL MPAMIZO", phone: "256712340069", invested: 9916700, value: 15838958.0, monthly: 0, advance: -1664630 },
  { name: "ISMAEL KAWOOYA", phone: "256759233204", invested: 11080000, value: 17696981.3, monthly: 400000, advance: -385000 },
  { name: "IVAN BAMWEYANA", phone: "256782180350", invested: 10935000, value: 17465387.3, monthly: 0, advance: -544500 },
  { name: "JUDE MUFUMUULA", phone: "256774717648", invested: 9838850, value: 15714616.0, monthly: 0, advance: -1750265 },
  { name: "LYDIA ABOLO", phone: "256703912822", invested: 8225000, value: 13136974.0, monthly: 0, advance: -3525500 },
  { name: "LYNN NINSIIMA", phone: "256774455448", invested: 11425000, value: 18248015.5, monthly: 0, advance: -5500 },
  { name: "NICHOLAS KABONGE", phone: "256777581340", invested: 12322700, value: 19681822.4, monthly: 1850000, advance: 892700 },
  { name: "SANDRA NANZIRI", phone: "256777804221", invested: 12225000, value: 19525775.9, monthly: 0, advance: 795000 },
  { name: "TOM AYEBARE", phone: "256782191982", invested: 9130000, value: 14582440.4, monthly: 0, advance: -2530000 },
];

const INVESTMENTS = [
  { name: "UAP Unit Trust - Umbrella", asset_class: "fixed_income", quantity: 1, cost_basis: 33189787.18, current_price: 33189787.18, current_value: 33189787.18, price_source: "uap" },
  { name: "Government Bond (June 2039)", asset_class: "fixed_income", quantity: 1, cost_basis: 50000000, current_price: 50000000, current_value: 50000000, price_source: "manual", notes: "15.8% coupon, semi-annual UGX 3,950,000 gross" },
  { name: "MTN Uganda", ticker: "MTNU", asset_class: "stocks", quantity: 17000, cost_basis: 3400000, current_price: 428, current_value: 7276000, price_source: "manual" },
  { name: "ProShares UltraPro QQQ", ticker: "TQQQ", asset_class: "stocks", quantity: 225.62, cost_basis: 17473891, current_price: 181537, current_value: 40956224, price_source: "yahoo" },
  { name: "Amplify Data Sharing ETF", ticker: "BLOK", asset_class: "stocks", quantity: 48.99, cost_basis: 3871356, current_price: 199290, current_value: 9762261, price_source: "yahoo" },
  { name: "ARK Innovation ETF", ticker: "ARKK", asset_class: "stocks", quantity: 19.69, cost_basis: 3044278, current_price: 255889, current_value: 5041637, price_source: "yahoo" },
  { name: "SPDR Kensho New Economies", ticker: "KOMP", asset_class: "stocks", quantity: 9.8, cost_basis: 1597988, current_price: 228492, current_value: 2238302, price_source: "yahoo" },
  { name: "ARK Genomic Revolution", ticker: "ARKG", asset_class: "stocks", quantity: 14.32, cost_basis: 1594346, current_price: 98499, current_value: 1410396, price_source: "yahoo" },
  { name: "Bitcoin", ticker: "BTC", asset_class: "digital_assets", quantity: 0.114681, cost_basis: 8825161, current_price: 269414530, current_value: 30896452, price_source: "binance" },
  { name: "Ethereum", ticker: "ETH", asset_class: "digital_assets", quantity: 1.28338, cost_basis: 9066882, current_price: 8293600, current_value: 10641727, price_source: "binance" },
  { name: "Solana", ticker: "SOL", asset_class: "digital_assets", quantity: 23.83, cost_basis: 10306717, current_price: 337615, current_value: 8045520, price_source: "binance" },
  { name: "XRP", ticker: "XRP", asset_class: "digital_assets", quantity: 815.31, cost_basis: 1616041, current_price: 4970, current_value: 4052024, price_source: "binance" },
  { name: "BNB", ticker: "BNB", asset_class: "digital_assets", quantity: 0.218, cost_basis: 168402, current_price: 2420505, current_value: 528648, price_source: "binance" },
  { name: "Chainlink", ticker: "LINK", asset_class: "digital_assets", quantity: 4.83, cost_basis: 190928, current_price: 34748, current_value: 167656, price_source: "binance" },
  { name: "USDC (Solana)", ticker: "USDCS", asset_class: "digital_assets", quantity: 453, cost_basis: 1705545, current_price: 3693, current_value: 1672390, price_source: "stablecoin" },
  { name: "USDC (Ethereum)", ticker: "USDCE", asset_class: "digital_assets", quantity: 302, cost_basis: 1137030, current_price: 3691, current_value: 1114927, price_source: "stablecoin" },
  { name: "Private Equity (GAS)", asset_class: "private_equity", quantity: 1, cost_basis: 14200000, current_price: 0, current_value: 0, price_source: "manual", is_active: false, notes: "Pending recovery" },
  { name: "Private Equity (PML)", asset_class: "private_equity", quantity: 1, cost_basis: 9000000, current_price: 0, current_value: 0, price_source: "manual", is_active: false, notes: "Pending recovery" },
  { name: "Cash at Bank (DFCU)", asset_class: "cash", quantity: 1, cost_basis: 2911368, current_price: 2911368, current_value: 2911368, price_source: "manual" },
  { name: "Cash Chipper (UGX)", asset_class: "cash", quantity: 1, cost_basis: 117000, current_price: 117000, current_value: 117000, price_source: "manual" },
];

const HISTORY = [
  { date: "2022-12-01", total_value: 96032194, total_invested: 85680550 },
  { date: "2023-06-01", total_value: 131064959, total_invested: 85125550 },
  { date: "2023-12-01", total_value: 210143777, total_invested: 100644250 },
  { date: "2024-06-01", total_value: 207436076, total_invested: 110509250 },
  { date: "2024-12-01", total_value: 269727640, total_invested: 124113250 },
  { date: "2025-06-01", total_value: 236273321, total_invested: 144868250 },
  { date: "2025-12-01", total_value: 267756366, total_invested: 152223250 },
  { date: "2026-03-01", total_value: 259009020, total_invested: 160673250 },
];

async function seed() {
  console.log("\n🌱 GM06 Investment Club — Database Seeder\n");

  // 1. Members
  console.log("👥 Creating members...");
  const memberIds = {};
  for (const m of MEMBERS) {
    const email = m.name.toLowerCase().replace(/\s+/g, ".") + "@gm06.club";
    const pwd = `gm06-${m.phone.slice(-4)}`;
    const hash = await bcrypt.hash(pwd, 10);

    const { data, error } = await supabase.from("members").upsert({
      name: m.name, email, phone: m.phone, role: m.role || "member",
      password_hash: hash, monthly_contribution: m.monthly, is_active: true,
    }, { onConflict: "email" }).select("id").single();

    if (error) { console.error(`  ✗ ${m.name}: ${error.message}`); continue; }
    memberIds[m.name] = data.id;
    console.log(`  ✓ ${m.name} → ${email} / ${pwd}`);
  }

  // 2. Seed initial contributions (one deposit per member matching their total invested)
  console.log("\n💰 Seeding contributions...");
  for (const m of MEMBERS) {
    if (!memberIds[m.name] || !m.invested) continue;
    await supabase.from("contributions").upsert({
      member_id: memberIds[m.name], amount: m.invested, type: "deposit",
      description: "Historical contributions (seeded)", date: "2026-03-01",
    }, { onConflict: "id", ignoreDuplicates: true });
  }

  // 3. Member snapshots
  console.log("\n📊 Creating March 2026 snapshots...");
  for (const m of MEMBERS) {
    if (!memberIds[m.name]) continue;
    await supabase.from("member_snapshots").upsert({
      member_id: memberIds[m.name], date: "2026-03-01",
      total_invested: m.invested, portfolio_value: m.value, advance_contribution: m.advance,
    }, { onConflict: "member_id,date" });
  }

  // 4. Investments
  console.log("\n📈 Creating investments...");
  for (const inv of INVESTMENTS) {
    const { error } = await supabase.from("investments").insert(inv);
    if (error) console.error(`  ✗ ${inv.name}: ${error.message}`);
    else console.log(`  ✓ ${inv.name}`);
  }

  // 5. Portfolio history
  console.log("\n📅 Creating portfolio history...");
  for (const h of HISTORY) {
    await supabase.from("portfolio_snapshots").upsert(h, { onConflict: "id", ignoreDuplicates: true });
  }

  console.log("\n✅ Seeding complete!\n");
  console.log("┌─────────────────────────────────────────┐");
  console.log("│  Login Credentials                      │");
  console.log("├─────────────────────────────────────────┤");
  console.log("│  Admin:  arnold.kibuuka@gm06.club       │");
  console.log("│          Password: gm06-1146            │");
  console.log("│                                         │");
  console.log("│  Member: nicholas.kabonge@gm06.club     │");
  console.log("│          Password: gm06-1340            │");
  console.log("└─────────────────────────────────────────┘\n");
}

seed().catch((e) => { console.error("Seed failed:", e.message); process.exit(1); });
