import { getServiceClient } from "./supabase";

const BINANCE_URL = "https://api.binance.com/api/v3";
const DEFAULT_UGX_RATE = 3691;

// Get UGX rate from settings, fallback to default
async function getUGXRate() {
  try {
    const db = getServiceClient();
    const { data } = await db.from("settings").select("value").eq("key", "ugx_rate").single();
    return parseFloat(data?.value) || DEFAULT_UGX_RATE;
  } catch {
    return DEFAULT_UGX_RATE;
  }
}

// Fetch current price from Binance for a crypto ticker (returns USD price)
async function fetchBinancePrice(ticker) {
  try {
    const symbol = ticker.replace("/", "") + "USDT";
    const res = await fetch(`${BINANCE_URL}/ticker/price?symbol=${symbol}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.price);
  } catch {
    return null;
  }
}

// Fetch current price from Yahoo Finance for US stocks/ETFs (returns USD price)
async function fetchYahooPrice(ticker) {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    return meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

// Update all investment prices from their sources
export async function updatePrices() {
  const db = getServiceClient();
  const { data: investments } = await db
    .from("investments")
    .select("*")
    .eq("is_active", true);

  if (!investments) return;

  const ugxRate = await getUGXRate();
  const updates = [];
  const errors = [];

  for (const inv of investments) {
    let usdPrice = null;

    if (inv.price_source === "binance" && inv.ticker) {
      usdPrice = await fetchBinancePrice(inv.ticker);
    } else if (inv.price_source === "yahoo" && inv.ticker) {
      usdPrice = await fetchYahooPrice(inv.ticker);
    } else if (inv.price_source === "stablecoin") {
      // Stablecoins pegged to $1 — price is just the UGX rate
      usdPrice = 1;
    }

    if (usdPrice !== null) {
      const ugxPrice = usdPrice * ugxRate;
      const value = Math.round(inv.quantity * ugxPrice * 100) / 100;
      updates.push({
        id: inv.id,
        name: inv.name,
        current_price: ugxPrice,
        current_value: value,
        updated_at: new Date().toISOString(),
      });

      // Record price history
      await db.from("price_history").insert({
        investment_id: inv.id,
        price: ugxPrice,
        value: value,
      });
    } else if (["binance", "yahoo"].includes(inv.price_source)) {
      errors.push(inv.name);
    }
  }

  // Batch update
  for (const u of updates) {
    await db.from("investments").update({
      current_price: u.current_price,
      current_value: u.current_value,
      updated_at: u.updated_at,
    }).eq("id", u.id);
  }

  return { updated: updates.length, errors };
}

// Get portfolio summary grouped by asset class
export async function getPortfolioSummary() {
  const db = getServiceClient();
  const { data: investments } = await db
    .from("investments")
    .select("*")
    .eq("is_active", true);

  if (!investments) return null;

  const summary = {};
  let totalValue = 0;

  for (const inv of investments) {
    if (!summary[inv.asset_class]) {
      summary[inv.asset_class] = { value: 0, cost: 0, investments: [] };
    }
    summary[inv.asset_class].value += inv.current_value || 0;
    summary[inv.asset_class].cost += inv.cost_basis || 0;
    summary[inv.asset_class].investments.push(inv);
    totalValue += inv.current_value || 0;
  }

  // Calculate percentages
  for (const cls in summary) {
    summary[cls].percentage = totalValue > 0 ? (summary[cls].value / totalValue) * 100 : 0;
  }

  return { summary, totalValue, investments };
}
