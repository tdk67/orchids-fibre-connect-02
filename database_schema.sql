-- All-in-One Solutions Database Schema
-- Execute this in your Supabase SQL Editor

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  employee_number TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  sparte TEXT DEFAULT 'Telekom',
  rolle TEXT DEFAULT 'Mitarbeiter',
  titel TEXT DEFAULT 'Mitarbeiter',
  teamleiter_id UUID,
  commission_rate DECIMAL(10,2) DEFAULT 0,
  fixed_commission DECIMAL(10,2) DEFAULT 0,
  bank_details TEXT,
  tax_id TEXT,
  google_calendar_link TEXT,
  email_adresse TEXT,
  smtp_server TEXT,
  smtp_port INTEGER DEFAULT 465,
  smtp_username TEXT,
  smtp_password TEXT,
  imap_server TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_username TEXT,
  imap_password TEXT,
  status TEXT DEFAULT 'Aktiv',
  user_id UUID,
  auth_user_id UUID,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  firma TEXT,
  ansprechpartner TEXT,
  stadt TEXT,
  postleitzahl TEXT,
  strasse_hausnummer TEXT,
  telefon TEXT,
  telefon2 TEXT,
  email TEXT,
  infobox TEXT,
  status TEXT,
  produkt TEXT,
  bandbreite TEXT,
  laufzeit_monate INTEGER DEFAULT 36,
  assigned_to TEXT,
  assigned_to_email TEXT,
  berechnete_provision DECIMAL(10,2) DEFAULT 0,
  teamleiter_bonus DECIMAL(10,2) DEFAULT 0,
  sparte TEXT DEFAULT 'Telekom',
  google_calendar_link TEXT,
  archiv_kategorie TEXT,
  archiviert_am DATE,
  verkaufschance_status TEXT,
  verloren BOOLEAN DEFAULT FALSE,
  pool_status TEXT,
  leadnummer TEXT,
  cluster_id TEXT,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create lead_status table
CREATE TABLE IF NOT EXISTS lead_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  color TEXT DEFAULT 'blue',
  "order" INTEGER DEFAULT 0
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  customer_name TEXT,
  employee_name TEXT,
  employee_id TEXT,
  sparte TEXT DEFAULT 'Telekom',
  product TEXT,
  bandwidth TEXT,
  contract_duration_months INTEGER DEFAULT 36,
  contract_value DECIMAL(10,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  sale_date DATE,
  commission_paid BOOLEAN DEFAULT FALSE,
  commission_month TEXT,
  notes TEXT,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create termine table
CREATE TABLE IF NOT EXISTS termine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  titel TEXT,
  beschreibung TEXT,
  startzeit TIMESTAMP WITH TIME ZONE,
  endzeit TIMESTAMP WITH TIME ZONE,
  mitarbeiter_email TEXT,
  mitarbeiter_name TEXT,
  kunde_name TEXT,
  lead_id UUID,
  typ TEXT DEFAULT 'Termin',
  status TEXT DEFAULT 'Geplant',
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create provisionsregeln table
CREATE TABLE IF NOT EXISTS provisionsregeln (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tarif TEXT,
  bandbreite TEXT,
  laufzeit_monate INTEGER DEFAULT 36,
  mitarbeiter_provision DECIMAL(10,2) DEFAULT 0,
  teamleiter_provision DECIMAL(10,2) DEFAULT 0,
  teamleiter_bonus_provision DECIMAL(10,2) DEFAULT 0,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create credit_notes table
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  employee_id UUID,
  employee_name TEXT,
  amount DECIMAL(10,2) DEFAULT 0,
  reason TEXT,
  month TEXT,
  status TEXT DEFAULT 'Offen',
  notes TEXT,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  status TEXT DEFAULT 'Aktiv',
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create bestandskunden table
CREATE TABLE IF NOT EXISTS bestandskunden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  firma TEXT,
  ansprechpartner TEXT,
  email TEXT,
  telefon TEXT,
  produkt TEXT,
  bandbreite TEXT,
  vertragslaufzeit_monate INTEGER,
  monatliche_kosten DECIMAL(10,2),
  vertragsende DATE,
  status TEXT DEFAULT 'Aktiv',
  notizen TEXT,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID,
  user_name TEXT,
  message TEXT,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create angebote table
CREATE TABLE IF NOT EXISTS angebote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  lead_id UUID,
  firma TEXT,
  ansprechpartner TEXT,
  strasse_hausnummer TEXT,
  postleitzahl TEXT,
  stadt TEXT,
  produkt TEXT,
  template_name TEXT,
  status TEXT DEFAULT 'Erstellt',
  erstellt_von TEXT,
  erstellt_datum DATE,
  notizen TEXT,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);

-- Create app_logs table
CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT,
  visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create queries table
CREATE TABLE IF NOT EXISTS queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  query_text TEXT,
  result TEXT,
  benutzertyp TEXT DEFAULT 'Interner Mitarbeiter'
);
