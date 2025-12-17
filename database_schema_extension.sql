-- Extensions to support the lead generation system from prototype
-- Run this AFTER the main database_schema.sql

-- Add missing columns to leads table for coordinates and area tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS within_area_bounds BOOLEAN DEFAULT TRUE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS area_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS branche TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS webseite TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

-- Create areas table for geographic lead generation
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT,
  bounds JSONB NOT NULL, -- {north, south, east, west}
  streets JSONB DEFAULT '[]'::jsonb, -- [{name, from_number, to_number}]
  color TEXT DEFAULT '#3b82f6',
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create generation_sessions table for tracking lead generation tasks
CREATE TABLE IF NOT EXISTS generation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  total_streets INTEGER NOT NULL,
  processed_streets INTEGER DEFAULT 0,
  found_leads INTEGER DEFAULT 0,
  current_street TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'paused', 'stopped', 'completed')),
  rescan BOOLEAN DEFAULT FALSE,
  logs JSONB DEFAULT '[]'::jsonb, -- [{timestamp, type, message}]
  created_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  total_streets_walk INTEGER DEFAULT 0,
  processed_streets_walk INTEGER DEFAULT 0
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_area_id ON leads(area_id);
CREATE INDEX IF NOT EXISTS idx_leads_coordinates ON leads(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_street_city ON leads(strasse_hausnummer, stadt);
CREATE INDEX IF NOT EXISTS idx_generation_sessions_status ON generation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_areas_city ON areas(city);

-- Add RLS policies (optional, adjust based on your auth setup)
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_sessions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all areas
CREATE POLICY "areas_enable_read_access" ON areas
  FOR SELECT USING (true);

-- Allow authenticated users to insert/update their own areas  
CREATE POLICY "areas_enable_insert" ON areas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "areas_enable_update" ON areas
  FOR UPDATE USING (true);

-- Generation sessions policies
CREATE POLICY "generation_sessions_enable_read_access" ON generation_sessions
  FOR SELECT USING (true);

CREATE POLICY "generation_sessions_enable_insert" ON generation_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "generation_sessions_enable_update" ON generation_sessions
  FOR UPDATE USING (true);
