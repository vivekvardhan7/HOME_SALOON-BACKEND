-- Add financial breakdown columns to monthly_earnings_summary if they don't exist
ALTER TABLE monthly_earnings_summary 
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS net_payable DECIMAL(10,2);
