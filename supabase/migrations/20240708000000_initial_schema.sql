-- EMS Data Pipeline Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Estimates table - main estimate data from EMS files
CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vin TEXT,
    claim_number TEXT,
    estimate_number TEXT UNIQUE,
    year INTEGER,
    make TEXT,
    model TEXT,
    trim_level TEXT,
    mileage INTEGER,
    drp_provider TEXT,
    insurance_company TEXT,
    adjuster_name TEXT,
    total_cost NUMERIC(10,2),
    labor_total NUMERIC(10,2),
    parts_total NUMERIC(10,2),
    tax_total NUMERIC(10,2),
    estimate_date DATE,
    completion_date DATE,
    status TEXT DEFAULT 'imported',
    line_items JSONB,
    vehicle_data JSONB,
    damage_assessment JSONB,
    source_file TEXT,
    file_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Images table - photos and documents associated with estimates
CREATE TABLE estimate_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    image_type TEXT, -- 'damage', 'vin', 'supplement', 'before', 'after'
    ocr_text TEXT,
    storage_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Parts table - normalized parts data from estimates
CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_number TEXT,
    part_name TEXT NOT NULL,
    oem_number TEXT,
    aftermarket_number TEXT,
    make TEXT,
    model TEXT,
    year_range TEXT,
    category TEXT,
    subcategory TEXT,
    list_price NUMERIC(10,2),
    cost NUMERIC(10,2),
    availability TEXT,
    supplier TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Estimate line items - detailed breakdown
CREATE TABLE estimate_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
    part_id UUID REFERENCES parts(id),
    line_number INTEGER,
    operation_type TEXT, -- 'replace', 'repair', 'refinish', 'supplement'
    part_description TEXT,
    quantity NUMERIC(8,2) DEFAULT 1,
    labor_hours NUMERIC(8,2),
    labor_rate NUMERIC(8,2),
    labor_cost NUMERIC(10,2),
    part_cost NUMERIC(10,2),
    total_cost NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DRP rules and pricing guidelines
CREATE TABLE drp_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name TEXT NOT NULL,
    rule_type TEXT, -- 'labor_rate', 'part_discount', 'procedure'
    rule_description TEXT,
    rule_data JSONB,
    effective_date DATE,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing logs
CREATE TABLE processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name TEXT,
    file_path TEXT,
    processing_status TEXT, -- 'pending', 'processing', 'completed', 'error'
    records_processed INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    error_details JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_estimates_vin ON estimates(vin);
CREATE INDEX idx_estimates_make_model ON estimates(make, model);
CREATE INDEX idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX idx_estimates_created_at ON estimates(created_at);
CREATE INDEX idx_estimate_images_estimate_id ON estimate_images(estimate_id);
CREATE INDEX idx_line_items_estimate_id ON estimate_line_items(estimate_id);
CREATE INDEX idx_parts_part_number ON parts(part_number);
CREATE INDEX idx_processing_logs_status ON processing_logs(processing_status);

-- RLS Policies (Row Level Security)
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE drp_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated access
CREATE POLICY "Allow authenticated access" ON estimates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON estimate_images FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON parts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON estimate_line_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON drp_rules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated access" ON processing_logs FOR ALL USING (auth.role() = 'authenticated');

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON estimates FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Allow service role full access" ON estimate_images FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Allow service role full access" ON parts FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Allow service role full access" ON estimate_line_items FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Allow service role full access" ON drp_rules FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Allow service role full access" ON processing_logs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('estimate-images', 'estimate-images', false);

-- Storage policy for images
CREATE POLICY "Allow authenticated users to upload images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'estimate-images' AND auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to read images" ON storage.objects FOR SELECT USING (bucket_id = 'estimate-images' AND auth.role() = 'authenticated');
CREATE POLICY "Allow service role full access to images" ON storage.objects FOR ALL USING (bucket_id = 'estimate-images' AND auth.jwt() ->> 'role' = 'service_role'); 