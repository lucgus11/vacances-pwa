-- =============================================
-- SCHÉMA SUPABASE - L'Ardoise des Vacances
-- Exécuter dans l'éditeur SQL de Supabase
-- =============================================

-- 1. Table de configuration (mot de passe global + paramètres)
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Mot de passe initial (SHA-256 de "vacances2025") — à changer dans l'app
INSERT INTO config (key, value)
VALUES ('password_hash', 'b0c1e8d2f3a4567890abcdef1234567890abcdef1234567890abcdef12345678')
ON CONFLICT (key) DO NOTHING;

INSERT INTO config (key, value)
VALUES ('vacation_name', 'Vacances Été 2025')
ON CONFLICT (key) DO NOTHING;

-- 2. Planning (L'Ardoise)
CREATE TABLE IF NOT EXISTS planning (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  moment      TEXT NOT NULL CHECK (moment IN ('matin', 'apres-midi', 'soiree')),
  title       TEXT NOT NULL,
  description TEXT,
  address     TEXT,        -- adresse cliquable → Google Maps
  lat         NUMERIC,
  lng         NUMERIC,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Boîte à idées (Anti-indécision)
CREATE TABLE IF NOT EXISTS ideas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('restaurant', 'activite')),
  title       TEXT NOT NULL,
  description TEXT,
  address     TEXT,
  proposed_by TEXT,
  votes       INTEGER DEFAULT 0,
  voters      TEXT[] DEFAULT '{}',  -- pour éviter les double-votes par pseudo
  selected    BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Billets & QR codes
CREATE TABLE IF NOT EXISTS tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  file_url     TEXT NOT NULL,  -- URL Supabase Storage
  file_type    TEXT,           -- 'image' | 'pdf'
  event_date   DATE,
  uploaded_by  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Galerie photos
CREATE TABLE IF NOT EXISTS photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url    TEXT NOT NULL,
  thumb_url   TEXT,
  caption     TEXT,
  uploaded_by TEXT,
  taken_at    DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_planning_date   ON planning(date);
CREATE INDEX IF NOT EXISTS idx_planning_moment ON planning(moment);
CREATE INDEX IF NOT EXISTS idx_ideas_type      ON ideas(type);
CREATE INDEX IF NOT EXISTS idx_photos_date     ON photos(created_at DESC);

-- =============================================
-- STORAGE BUCKETS (à créer dans Supabase Dashboard > Storage)
-- =============================================
-- Bucket : "tickets"  → public: false (ou true selon préférence)
-- Bucket : "photos"   → public: false

-- =============================================
-- ROW LEVEL SECURITY — désactivé pour usage famille
-- (tout le monde partage le même mot de passe)
-- =============================================
ALTER TABLE config   DISABLE ROW LEVEL SECURITY;
ALTER TABLE planning DISABLE ROW LEVEL SECURITY;
ALTER TABLE ideas    DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets  DISABLE ROW LEVEL SECURITY;
ALTER TABLE photos   DISABLE ROW LEVEL SECURITY;

-- =============================================
-- FONCTION utilitaire : mise à jour auto de updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_planning_updated
  BEFORE UPDATE ON planning
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
