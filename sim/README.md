# Fleet Fuel-Theft Detection — Simulation (Edge Filtering + Cloud Algorithm)

A data/signal-level simulation matching your real architecture:
**ESP32 (sensors + IIR filtering) -> Supabase (`telemetry` table) -> cloud
classification algorithm.** No dashboard, no real hardware/Wokwi — this is
a synthetic-but-physically-modeled "digital twin" so we get exact ground
truth to score against (the same role real recorded data played in
Biernacki & Libal, 2025, except we define the truth ourselves).

## Pipeline (3 stages, 3 files)

```
generate_data.py   Simulates the RAW, sloshing-corrupted sensor stream a
                    vehicle would produce (fuel, GPS, speed, motion-derived
                    noise) with known ground-truth events: 2 thefts, 1
                    continuous leak, 2 legitimate refuels, a signal dropout.
                    -> sim_raw_data.csv (NOT what Supabase stores -- this
                       stays on the vehicle / in this simulation only)

edge_firmware.py    Simulates what now runs ON THE ESP32: the IIR
                    (Butterworth, order 10) sloshing-compensation filter,
                    plus GSM transmission jitter and packet loss/blackout.
                    -> supabase_telemetry.csv   (EXACT real schema:
                       device_id, fuel_level, distance_cm, latitude,
                       longitude, speed_kmph, timestamp, received_at)
                    -> supabase_telemetry_debug.csv (schema + ground truth,
                       for scoring only -- not a real Supabase column set)

cloud_algo.py       THE ALGORITHM. Reads ONLY the real Supabase schema
                    columns and classifies each row as Normal / Theft /
                    Leak / Refuel / Anomalous rise / Unverified (data gap).
                    Entry point: classify(df, stations) -> df + 'status'
                    + 'event_id' columns. See "The Algorithm" below.

run_simulation.py   Orchestrates all of the above, scores cloud_algo against
                    ground truth, compares against a naive raw-signal/fixed-
                    threshold baseline (representing the literature you
                    reviewed), saves plots + results_summary.json.
```

## How to run it

```bash
pip install -r requirements.txt

python3 generate_data.py     # writes sim_raw_data.csv
python3 run_simulation.py    # runs edge_firmware.py itself, then classifies,
                              # scores, and plots
```

Two commands after install (`run_simulation.py` calls `edge_firmware.py`
for you). It prints two tables to the terminal (fuel-estimation accuracy,
theft-detection precision/recall) plus the events `cloud_algo` detected,
and saves `fig_trip_overview.png`, `fig_theft_zoom.png`, and
`results_summary.json`.

## The Algorithm (`cloud_algo.py`)

**Stage A — Motion & geofence.** Motion state from `speed_kmph`
(cross-checked with GPS displacement between consecutive points). Tracks
`stationary_since` per device. Computes haversine distance to the nearest
row in a small reference `fuel_stations` table -> `at_station` flag.

**Stage B — Drop-rate & per-device baseline.** `drop_rate_Lpm` = change in
`fuel_level` over a trailing **time** window (2 min, using real `timestamp`
deltas, not sample count -- tolerant of irregular GSM intervals). A
per-device rolling baseline (mean/std over 2 hrs) gives a z-score: how
unusual the current rate is for *this vehicle's own* recent behaviour.

**Stage C — Rule-based candidates.**
- Falling fast + stationary + off-station -> candidate Theft
- Rising fast + stationary -> candidate Refuel (at-station) / Anomalous
  rise (off-station, flagged for review)
- Small-but-sustained excess drop above baseline, either motion state,
  persisting -> candidate Leak

**Stage D — Confirmation.**
- **Theft**: confirmed once persisted >=60s (the absolute-rate + stationary
  + off-station combination is already specific); z-score is used only as
  a *high-confidence* tag, not a hard gate — a hard z-gate here fails
  whenever another anomaly (e.g. a concurrent leak) is already inflating
  the rolling baseline's variance.
- **Leak**: confirmed only if persisted >=20 min **and** z > 2 — leak's
  threshold is deliberately low/sensitive, so it needs the statistical
  check to avoid firing on ordinary driving variation.
- **Refuel**: confirmed once the rise completes with volume >= minimum.

**Stage E — Event consolidation.** Consecutive same-label confirmed/under-
watch rows are merged into one event (start, end, volume change, location)
via `summarize_events()`, so alerts fire once per event, not once per row.
Large `received_at` gaps are marked "Unverified - data gap" rather than
scored as a rate at all, so an offline period isn't misread as a leak.

## Results (this run)

| Signal | Mean error at refuel (L) | Overall RMSE vs. ground truth |
|---|---|---|
| Raw (no edge filtering) | 0.08 L | 9.09 L |
| FIR order 50 | 1.12 L | 11.65 L |
| **fuel_level (edge IIR order 10)** | 1.47 L | **3.72 L** |

| Method | Precision | Recall | False positives |
|---|---|---|---|
| Naive (raw + fixed threshold, no fusion) | 0.001 | 1.0 | 5,122 / 17,644 (29%) |
| **cloud_algo** (edge IIR + GPS/motion + geofence + z-score) | **1.0** | **1.0** | **0 / 17,644** |

Both simulated thefts detected with zero false positives across the whole
5-hour trip (which includes a concurrent continuous leak, a signal dropout,
~1% random packet loss, and a 3-minute blackout) -- despite the leak
actively trying to contaminate the theft z-score baseline (see Stage D
notes above for how that's handled).

## When you have real fleet data instead of simulated data

Nothing in `cloud_algo.py` needs to change -- it already reads only the
Supabase schema. Point `edge_firmware.py`'s input (or skip it entirely) at
your real `telemetry` table export and run `cloud_algo.classify()` on it
directly. The thresholds at the top of `cloud_algo.py` (`THEFT_RATE_LPM`,
`LEAK_EXCESS_LPM`, `REFUEL_RATE_LPM`, persistence durations, z-score bars)
are the values to tune against real vehicles.
