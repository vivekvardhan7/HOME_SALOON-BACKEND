-- Add VAT support to bookings (Salon/Legacy)
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vendor_payout_amount DECIMAL(10,2);

-- Add VAT support to athome_bookings
ALTER TABLE athome_bookings
ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vendor_payout_amount DECIMAL(10,2);

-- Add VAT support to vendor_orders (Direct Salon Bookings)
ALTER TABLE vendor_orders
ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS platform_commission DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS vendor_payout_amount DECIMAL(10,2);


-- Backfill Legacy Data
-- Rule: treat existing totals as VAT-inclusive (16% VAT)
-- Base = Total / 1.16
-- VAT = Total - Base
-- Commission = Base * 15%
-- Payout = Base * 85%

UPDATE bookings 
SET 
  base_amount = ROUND(total / 1.16, 2), 
  vat_amount = ROUND(total - (total / 1.16), 2), 
  platform_commission = ROUND((total / 1.16) * 0.15, 2), 
  vendor_payout_amount = ROUND((total / 1.16) * 0.85, 2) 
WHERE base_amount IS NULL 
  AND total > 0;

UPDATE athome_bookings 
SET 
  base_amount = ROUND(total_amount / 1.16, 2), 
  vat_amount = ROUND(total_amount - (total_amount / 1.16), 2), 
  platform_commission = ROUND((total_amount / 1.16) * 0.15, 2), 
  vendor_payout_amount = ROUND((total_amount / 1.16) * 0.85, 2) 
WHERE base_amount IS NULL 
  AND total_amount > 0;

UPDATE vendor_orders
SET 
  base_amount = ROUND(total_amount / 1.16, 2), 
  vat_amount = ROUND(total_amount - (total_amount / 1.16), 2), 
  platform_commission = ROUND((total_amount / 1.16) * 0.15, 2), 
  vendor_payout_amount = ROUND((total_amount / 1.16) * 0.85, 2) 
WHERE base_amount IS NULL 
  AND total_amount > 0;
