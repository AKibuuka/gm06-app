export function fmtUGX(n) {
  if (n == null || isNaN(n)) return "-";
  return `USh${Math.round(n).toLocaleString()}`;
}

export function fmtShort(n) {
  if (n === 0) return "-";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

export function fmtPct(n) {
  return `${Number(n).toFixed(1)}%`;
}

export function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function titleCase(name) {
  if (!name) return "";
  return name.split(" ").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
}

export const ASSET_CLASS_LABELS = {
  fixed_income: "Fixed Income Securities (UAP)",
  stocks: "Stocks",
  digital_assets: "Digital Assets",
  real_estate: "Real Estate",
  private_equity: "Private Equity",
  loans: "Loans",
  cash: "Cash",
};

export const ASSET_CLASS_COLORS = {
  fixed_income: "#0F766E",
  stocks: "#1D4ED8",
  digital_assets: "#9333EA",
  real_estate: "#CA8A04",
  private_equity: "#DC2626",
  loans: "#EA580C",
  cash: "#059669",
};
