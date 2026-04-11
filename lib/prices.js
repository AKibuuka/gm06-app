import { getServiceClient } from "./supabase";

const BINANCE_URL = "https://api.binance.com/api/v3";

// Get UGX rate from settings, fallback to default
async function getUGXRate() {
  try {
    const db = getServiceClient();
    const { data } = await db.from("settings").select("value").eq("key", "ugx_rate").single();
    return parseFloat(data?.value) || 3691;
  } catch {
    return 3691;
  }
}

// Fetch current price from Binance for a ticker
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
  for (const inv of investments) {
    if (inv.price_source === "binance" && inv.ticker) {
      const usdPrice = await fetchBinancePrice(inv.ticker);
      if (usdPrice !== null) {
        const ugxPrice = usdPrice * ugxRate;
        const value = inv.quantity * ugxPrice;
        updates.push({
          id: inv.id,
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
      }
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

  return updates.length;
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
