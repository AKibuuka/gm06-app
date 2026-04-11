-- ============================================================
-- GM06 — Add Yahoo Finance and Stablecoin price sources
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Expand price_source CHECK constraint to include yahoo and stablecoin
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_price_source_check;
ALTER TABLE investments ADD CONSTRAINT investments_price_source_check
  CHECK (price_source IN ('binance', 'manual', 'uap', 'yahoo', 'stablecoin'));

-- 2. Update US-listed ETFs/stocks to use Yahoo Finance
UPDATE investments SET price_source = 'yahoo' WHERE ticker IN ('TQQQ', 'BLOK', 'ARKK', 'KOMP', 'ARKG');

-- 3. Update USDC stablecoins to auto-price at $1 × UGX rate
UPDATE investments SET price_source = 'stablecoin' WHERE ticker IN ('USDCS', 'USDCE');
