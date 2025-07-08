-- Migration: Add location tracking fields
-- Date: 2024-12-19
-- Description: Add location/shop identification fields for multi-location deployments

-- Add location fields to estimates table
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS shop_id TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS shop_address TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS shop_region TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS computer_name TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS shop_contact JSONB;

-- Add location fields to processing_logs table
ALTER TABLE processing_logs ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE processing_logs ADD COLUMN IF NOT EXISTS shop_id TEXT;
ALTER TABLE processing_logs ADD COLUMN IF NOT EXISTS computer_name TEXT;

-- Add indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_estimates_shop_id ON estimates(shop_id);
CREATE INDEX IF NOT EXISTS idx_estimates_shop_name ON estimates(shop_name);
CREATE INDEX IF NOT EXISTS idx_processing_logs_shop_id ON processing_logs(shop_id);

-- Add comments for documentation
COMMENT ON COLUMN estimates.shop_name IS 'Name of the shop/location where estimate was processed';
COMMENT ON COLUMN estimates.shop_id IS 'Unique identifier for the shop/location';
COMMENT ON COLUMN estimates.shop_address IS 'Physical address of the shop';
COMMENT ON COLUMN estimates.shop_region IS 'Geographic region (e.g., Northeast, West Coast)';
COMMENT ON COLUMN estimates.computer_name IS 'Name of the computer that processed the estimate';
COMMENT ON COLUMN estimates.timezone IS 'Timezone of the shop location';
COMMENT ON COLUMN estimates.shop_contact IS 'Contact information for the shop (phone, email)';

COMMENT ON COLUMN processing_logs.shop_name IS 'Name of the shop where file was processed';
COMMENT ON COLUMN processing_logs.shop_id IS 'Shop identifier for processing log';
COMMENT ON COLUMN processing_logs.computer_name IS 'Computer that processed the file'; 