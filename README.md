# FuelGuard — Fleet Monitoring Dashboard

A fleet monitoring dashboard for an IoT-based vehicle fuel monitoring and
anomaly detection system. Built with React, Vite, Tailwind CSS, Supabase,
Recharts, and Leaflet.

## Stack

- React 18 + Vite
- Tailwind CSS (custom dark instrument-panel theme)
- Supabase JS client (`@supabase/supabase-js`) — data + realtime
- Recharts — fuel/speed trend charts
- react-leaflet + Leaflet (OpenStreetMap tiles) — fleet map
- lucide-react — icons
- react-router-dom — routing

## Getting started

```bash
npm install
cp .env.example .env
# edit .env with your Supabase project URL and anon key
npm run dev
```

The app runs on `http://localhost:5173`.

If `.env` is left unconfigured, the app still runs — every page shows an
honest "not configured" / "N/A" state rather than fake data, per the
project's data-integrity requirements.

## Environment variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Never put `SUPABASE_SERVICE_ROLE_KEY` in this project — the frontend only
ever uses the public anon key, and reads/writes should be governed by
Supabase Row Level Security policies.

## Expected Supabase schema

The dashboard expects these tables. `vehicles` and `telemetry` are
required; `events` is optional — the UI degrades to a clean "No detected
events" empty state if it doesn't exist yet.

```sql
create table vehicles (
  id bigint generated always as identity primary key,
  vehicle_id text unique not null,
  vehicle_name text not null,
  device_id text
);

create table telemetry (
  id bigint generated always as identity primary key,
  vehicle_id text not null references vehicles(vehicle_id),
  device_id text,
  fuel_level numeric,        -- null until calibration is complete
  distance_cm numeric,
  latitude double precision, -- 0 is treated as "no fix", not a real location
  longitude double precision,
  speed_kmph numeric,
  timestamp timestamptz,
  received_at timestamptz default now()
);

-- optional — created later once the detection pipeline exists
create table events (
  id bigint generated always as identity primary key,
  vehicle_id text references vehicles(vehicle_id),
  event_type text check (event_type in ('NORMAL','REFUEL','LEAK','THEFT')),
  severity text check (severity in ('HIGH','MEDIUM','LOW')),
  fuel_before numeric,
  fuel_after numeric,
  fuel_change numeric,
  latitude double precision,
  longitude double precision,
  confidence numeric,
  timestamp timestamptz default now(),
  status text default 'Warning' -- Normal | Warning | Critical | Resolved
);
```

Enable Row Level Security on all three tables and add a read policy for
the `anon` role (or an authenticated role, once auth is added) scoped to
what the dashboard should be allowed to see.

## Project structure

```
src/
  components/   Sidebar, Header, StatCard, VehicleCard, VehicleTable,
                StatusBadge, FuelChart, SpeedChart, EventCard, MapView,
                LoadingState, EmptyState, ErrorState
  pages/        Dashboard, Vehicles, VehicleDetails, LiveMonitoring,
                FuelAnalytics, Events, Map, Settings
  services/     vehicleService, telemetryService, eventService
                (all Supabase queries live here — never in components)
  lib/          supabase client, formatting helpers
```

## How it handles missing/placeholder data

- **`fuel_level = null`** — shown as "Fuel calibration pending"; the raw
  `distance_cm` reading is shown alongside it. The frontend never
  converts distance to a fuel percentage itself.
- **GPS `0,0`** — treated as "no fix", never plotted on the map or shown
  as a real location.
- **No `events` table / no rows** — pages show "No detected events"
  rather than inventing theft/leak/refuel activity. The frontend never
  runs its own detection logic; it only visualizes what the backend
  classifies.
- **Any metric that can't be honestly computed yet** (e.g. today's fuel
  consumption, which needs backend analytics) — shown as "N/A" with a
  short hint, never a placeholder number.
- **A vehicle counts as online** if its latest telemetry arrived in the
  last 60 seconds (`ONLINE_THRESHOLD_MS` in `telemetryService.js`).

## Live monitoring

The Live Monitoring page polls Supabase every 8 seconds and also
subscribes to realtime `INSERT` events on the `telemetry` table (if
Realtime is enabled on your Supabase project), so new readings can
appear immediately between polls without hammering the database.

## Running and testing

```bash
npm run dev       # local dev server with hot reload
npm run build     # production build to dist/
npm run preview   # preview the production build locally
```

To test without real hardware, insert rows into `telemetry` directly via
the Supabase SQL editor or table editor — the dashboard reads live from
the table, so new rows appear on the next poll/refresh.

## Adding the Fleet Manager role later

The service layer (`src/services/*`) is the only place that talks to
Supabase. To add `FLEET_MANAGER` scoping later:

1. Add a `fleet_manager_id` (or similar) column to `vehicles`.
2. Add a Supabase RLS policy restricting `SELECT` on `vehicles` (and by
   extension `telemetry`/`events` via join) to a manager's assigned
   vehicles.
3. No frontend query code needs to change — RLS enforces the scoping
   server-side, and `getVehicles()` will simply return the filtered set
   for whoever is signed in.
