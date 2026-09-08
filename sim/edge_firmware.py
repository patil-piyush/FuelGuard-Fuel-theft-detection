"""
edge_firmware.py
-----------------
Simulates the part of the pipeline that now runs ON THE ESP32 itself
(edge computing), not in the cloud: the IIR (Butterworth) sloshing-
compensation filter applied to the raw pressure-probe reading.

Input:  sim_raw_data.csv          (raw, sloshing-corrupted sensor stream --
                                    this never leaves the vehicle)
Output: supabase_telemetry.csv    (EXACTLY your real Supabase schema --
                                    this is what actually gets stored)
        supabase_telemetry_debug.csv (schema + ground-truth columns kept
                                    alongside, for scoring the simulation
                                    only -- your real Supabase table would
                                    NOT have these extra columns)

Supabase `telemetry` table schema (as given):
    device_id, fuel_level, distance_cm, latitude, longitude,
    speed_kmph, timestamp, received_at
"""
import numpy as np
import pandas as pd
from pipeline import iir_filter

rng = np.random.default_rng(7)

raw = pd.read_csv("./sim_raw_data.csv", parse_dates=["timestamp"])

# ---- On-ESP32 processing: IIR filter the raw fuel signal -----------------
# This is the only transformation edge computing performs. distance_cm is
# passed through as-is (it's the raw analog reading the sensor reports
# alongside the already-filtered fuel_level -- kept for diagnostics).
raw["fuel_level"] = iir_filter(raw["fuel_raw_L"].to_numpy(), order=10, cutoff_hz=0.02)

# ---- Simulate GSM transmission delay/jitter for received_at --------------
jitter_s = rng.uniform(1.0, 6.0, len(raw))
raw["received_at"] = raw["timestamp"] + pd.to_timedelta(jitter_s, unit="s")

# ---- Simulate occasional missed transmissions (device offline) -----------
# Drop a small random fraction of rows, plus one deliberate longer blackout,
# so the algorithm has to handle irregular sampling and data gaps -- exactly
# what a real GSM-connected fleet device will produce.
n_before = len(raw)
keep = rng.random(len(raw)) > 0.01  # ~1% random packet loss
blackout = ~((raw["t_s"] >= 12000) & (raw["t_s"] < 12180))  # 3 min blackout
raw = raw[keep & blackout].reset_index(drop=True)

# ---- Write the real Supabase-schema table ---------------------------------
supabase_cols = ["device_id", "fuel_level", "distance_cm", "latitude",
                  "longitude", "speed_kmph", "timestamp", "received_at"]
raw[supabase_cols].to_csv("./supabase_telemetry.csv", index=False)

# ---- Debug copy for scoring the simulation (keeps ground truth) ----------
debug_cols = supabase_cols + ["fuel_gt_L", "fuel_raw_L", "event_label", "t_s"]
raw[debug_cols].to_csv("./supabase_telemetry_debug.csv", index=False)

print(f"Rows written: {len(raw)} (dropped {n_before - len(raw)} for packet loss/blackout)")
print("Saved -> supabase_telemetry.csv   (real schema, what actually reaches Supabase)")
print("Saved -> supabase_telemetry_debug.csv (+ ground truth, for scoring only)")
