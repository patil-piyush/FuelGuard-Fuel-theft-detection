-- Migration: Add profiles table and role‑based RLS policies
-- This migration is safe to run on an existing Supabase project.
-- It creates a profiles table linked to auth.users and adds row‑level security
-- policies that enforce the application roles ADMIN and FLEET_MANAGER.

-- 1. Create profiles table (id references auth.users.id)
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('ADMIN', 'FLEET_MANAGER'))
);

-- 2. Enable RLS on core tables (if not already enabled)
ALTER TABLE IF EXISTS vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS events ENABLE ROW LEVEL SECURITY;

-- 3. SELECT policies – allow any authenticated user to read data
DROP POLICY IF EXISTS select_vehicles ON vehicles;
CREATE POLICY select_vehicles ON vehicles
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS select_telemetry ON telemetry;
CREATE POLICY select_telemetry ON telemetry
    FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS select_events ON events;
CREATE POLICY select_events ON events
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. WRITE policies – allow only ADMIN role to modify data
DROP POLICY IF EXISTS write_vehicles ON vehicles;
CREATE POLICY write_vehicles ON vehicles
    FOR INSERT, UPDATE, DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS write_telemetry ON telemetry;
CREATE POLICY write_telemetry ON telemetry
    FOR INSERT, UPDATE, DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

DROP POLICY IF EXISTS write_events ON events;
CREATE POLICY write_events ON events
    FOR INSERT, UPDATE, DELETE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- 5. (Optional) Ensure that the profiles table itself is readable by the owner
--    and that only the owner can modify their own profile.
DROP POLICY IF EXISTS select_profiles ON profiles;
CREATE POLICY select_profiles ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS update_profiles ON profiles;
CREATE POLICY update_profiles ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- End of migration
