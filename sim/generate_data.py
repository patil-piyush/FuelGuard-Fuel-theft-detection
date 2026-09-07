"""
generate_data.py
-----------------
Builds a synthetic, but physically-motivated, 5-hour vehicle trip dataset that
mimics the raw telemetry an ESP32 node (hydrostatic pressure fuel sensor +
GPS + motion sensor + RTC) would stream to Supabase.

This plays the same role that the real TIR-truck dataset played in
Biernacki & Libal (2025): a ground-truth-labeled signal we can filter and
then score an algorithm against. Since we have no access to real proprietary
fleet telemetry, the ground truth here is defined by us (fully known), which
lets us compute exact accuracy/precision/recall numbers instead of relying on
invoice-based ground truth as the original paper had to.

Output: sim_raw_data.csv with columns:
  t_s, timestamp, speed_kmh, accel, location_state, lat, lon,
  fuel_gt_L, fuel_raw_L, event_label
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

rng = np.random.default_rng(42)

DT = 1.0                      # sampling interval, seconds (1 Hz)
DURATION_S = 5 * 3600         # 5-hour trip
N = int(DURATION_S / DT)
TANK_CAPACITY_L = 400.0
START_FUEL_L = 380.0

t = np.arange(N) * DT

# ---------------------------------------------------------------
# 1. Speed profile (km/h) -- depot -> drive -> theft stop -> drive
#    -> refuel -> drive -> theft stop -> drive -> refuel -> depot
# ---------------------------------------------------------------
speed = np.zeros(N)

def set_speed(t0, t1, base, noise=4.0, ramp=60):
    i0, i1 = int(t0 / DT), int(t1 / DT)
    seg = np.full(i1 - i0, base) + rng.normal(0, noise, i1 - i0)
    seg = np.clip(seg, 0, None)
    r = min(ramp, (i1 - i0) // 2)
    if r > 0:
        seg[:r] *= np.linspace(0, 1, r)
        seg[-r:] *= np.linspace(1, 0, r)
    speed[i0:i1] = seg

# Depot idle
set_speed(0, 300, 0, noise=0)
# Leg 1
set_speed(300, 1500, 65, noise=6)
set_speed(1500, 1560, 5, noise=2)     # traffic-light stop
set_speed(1560, 3600, 70, noise=7)
# THEFT STOP 1 (t=3600-3900): vehicle fully stationary
set_speed(3600, 3900, 0, noise=0)
# Leg 2 (leak starts at t=5000, handled in fuel section)
set_speed(3900, 7200, 68, noise=7)
# REFUEL STOP 1 (t=7200-7500)
set_speed(7200, 7500, 0, noise=0)
# Leg 3
set_speed(7500, 10800, 72, noise=8)
# THEFT STOP 2 (t=10800-11100)
set_speed(10800, 11100, 0, noise=0)
# Leg 4
set_speed(11100, 14400, 66, noise=7)
# REFUEL STOP 2 (t=14400-14700)
set_speed(14400, 14700, 0, noise=0)
# Leg 5 -> depot
set_speed(14700, N * DT, 60, noise=6)
set_speed(N * DT - 300, N * DT, 0, noise=0)

speed = np.clip(speed, 0, None)
speed_mps = speed / 3.6
accel = np.gradient(speed_mps, DT)   # m/s^2

# ---------------------------------------------------------------
# 2. Location state (categorical proxy for lat/lon + geofence)
# ---------------------------------------------------------------
LOC_DEPOT, LOC_ROAD, LOC_STATION, LOC_ROADSIDE_A, LOC_ROADSIDE_B = (
    "Depot", "OnRoad", "FuelStation", "RoadsideA", "RoadsideB")

location_state = np.full(N, LOC_ROAD, dtype=object)
location_state[(t >= 0) & (t < 300)] = LOC_DEPOT
location_state[(t >= 3600) & (t < 3900)] = LOC_ROADSIDE_A   # theft 1
location_state[(t >= 7200) & (t < 7500)] = LOC_STATION      # refuel 1
location_state[(t >= 10800) & (t < 11100)] = LOC_ROADSIDE_B  # theft 2
location_state[(t >= 14400) & (t < 14700)] = LOC_STATION    # refuel 2
location_state[(t >= N * DT - 300)] = LOC_DEPOT

# Dummy lat/lon just so the dataset "looks" like real GPS output
coord_map = {
    LOC_DEPOT: (18.6298, 73.7997), LOC_STATION: (18.6050, 73.7500),
    LOC_ROADSIDE_A: (18.6510, 73.8200), LOC_ROADSIDE_B: (18.5800, 73.7100),
}
lat = np.full(N, np.nan); lon = np.full(N, np.nan)
for i in range(N):
    if location_state[i] in coord_map:
        lat[i], lon[i] = coord_map[location_state[i]]
    else:
        frac = (i % 3600) / 3600
        lat[i] = 18.62 - 0.02 * frac + rng.normal(0, 0.0005)
        lon[i] = 73.77 + 0.02 * frac + rng.normal(0, 0.0005)

# ---------------------------------------------------------------
# 3. Ground-truth fuel level (L) -- consumption + leak + theft + refuel
# ---------------------------------------------------------------
fuel_gt = np.zeros(N)
fuel_gt[0] = START_FUEL_L
event_label = np.full(N, "Normal", dtype=object)

MOVING_BURN = 25.0 / 3600      # L/s while driving (~25 L/hr)
IDLE_BURN = 1.0 / 3600         # L/s while idling engine-on
LEAK_START = 5000
LEAK_RATE = 14.0 / 3600        # L/s constant leak from LEAK_START onward

THEFT1 = (3600, 3900, 35.0)    # (t0, t1, liters lost)
THEFT2 = (10800, 11100, 30.0)
REFUEL1 = (7200, 7500, 150.0)
REFUEL2 = (14400, 14700, 100.0)

for i in range(1, N):
    ti = t[i]
    dfuel = 0.0
    moving = speed[i] > 5
    dfuel -= (MOVING_BURN if moving else IDLE_BURN) * DT
    if ti >= LEAK_START:
        dfuel -= LEAK_RATE * DT
        event_label[i] = "Leak"
    for (a, b, liters) in [THEFT1, THEFT2]:
        if a <= ti < b:
            dfuel -= (liters / (b - a)) * DT
            event_label[i] = "Theft"
    for (a, b, liters) in [REFUEL1, REFUEL2]:
        if a <= ti < b:
            dfuel += (liters / (b - a)) * DT
            event_label[i] = "Refuel"
    fuel_gt[i] = np.clip(fuel_gt[i - 1] + dfuel, 0, TANK_CAPACITY_L)

# ---------------------------------------------------------------
# 4. Raw noisy sensor signal (sloshing + baseline sensor noise + a
#    short signal-fade dropout, mirroring the disturbances listed
#    in Biernacki & Libal, Section II)
# ---------------------------------------------------------------
base_noise = rng.normal(0, 1.2, N)
accel_norm = np.abs(accel) / (np.abs(accel).max() + 1e-6)
slosh_envelope = 2.0 + 55.0 * accel_norm + 6.0 * (speed > 5)
# Genuine high-frequency sloshing oscillation (~0.08 Hz carrier, i.e. ~12 s
# period -- well above the IIR cutoff used later) with a slowly-wandering
# phase/amplitude so it looks organic rather than a pure tone.
slosh_carrier = 2 * np.pi * 0.08 * t
slosh_phase_jitter = np.cumsum(rng.normal(0, 0.05, N))
slosh_noise = slosh_envelope * np.sin(slosh_carrier + slosh_phase_jitter) * rng.uniform(0.7, 1.0, N)

fuel_raw = fuel_gt + base_noise + slosh_noise

# Signal fade / dropout: sensor freezes at last value for ~30 s
fade_i0 = int(8000 / DT); fade_i1 = int(8030 / DT)
fuel_raw[fade_i0:fade_i1] = fuel_raw[fade_i0]

fuel_raw = np.clip(fuel_raw, 0, TANK_CAPACITY_L + 20)

# ---------------------------------------------------------------
# 5. RTC timestamps + assemble dataframe
# ---------------------------------------------------------------
t0 = datetime(2026, 8, 1, 6, 0, 0)
timestamps = [t0 + timedelta(seconds=float(s)) for s in t]

df = pd.DataFrame({
    "device_id": "TRUCK-001",
    "t_s": t, "timestamp": timestamps, "speed_kmph": speed, "accel_mps2": accel,
    "location_state": location_state, "latitude": lat, "longitude": lon,
    "fuel_gt_L": fuel_gt, "fuel_raw_L": fuel_raw, "event_label": event_label,
})
# distance_cm: raw analog placeholder for what an ultrasonic/pressure sensor's
# pre-conversion reading would look like (simple inverse mapping to the noisy
# raw liters signal) -- included only so the dataset carries the real Supabase
# column name; the algorithm never uses this directly, it uses fuel_level
# (produced by edge_firmware.py after on-ESP32 IIR filtering).
TANK_HEIGHT_CM = 120.0
df["distance_cm"] = np.clip(TANK_HEIGHT_CM * (1 - df["fuel_raw_L"] / TANK_CAPACITY_L), 0, TANK_HEIGHT_CM)

df.to_csv("/home/claude/sim/sim_raw_data.csv", index=False)
print("Rows:", len(df))
print(df["event_label"].value_counts())
print("Saved -> sim_raw_data.csv")
