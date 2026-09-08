"""
cloud_algo.py
-------------
The theft / leak / refuel classification algorithm. Runs server-side
(e.g. as a Supabase Edge Function / scheduled job) on rows already sitting
in the `telemetry` table:

    device_id, fuel_level, distance_cm, latitude, longitude,
    speed_kmph, timestamp, received_at

`fuel_level` has ALREADY been IIR-filtered on the ESP32 (edge computing) --
this algorithm does no further sloshing compensation, it only reasons about
motion, location, and the rate/persistence/statistical-unusualness of
fuel-level change. See README.md for the English step-by-step description;
this module is the direct code implementation of those steps (A-E).

Public entry point: classify(df, stations) -> DataFrame with two new
columns: `status` (per-row candidate/confirmed label) and `event_id`
(groups consolidated events -- NaN while status == "Normal").
"""
import numpy as np
import pandas as pd
from collections import deque

# ---------------------------------------------------------------
# Reference data: known fuel-station geofences. In production this is a
# separate small Supabase table (e.g. `fuel_stations`), not hardcoded --
# kept here as a stand-in with the same coordinates used by generate_data.py.
# ---------------------------------------------------------------
DEFAULT_STATIONS = pd.DataFrame([
    {"name": "Station-1", "lat": 18.6050, "lon": 73.7500, "radius_m": 150},
])

# ---------------------------------------------------------------
# Tunable thresholds (Stage C / D). Kept at module level so they're easy
# to sweep/tune against real fleet data later.
# ---------------------------------------------------------------
MOVING_SPEED_KMPH = 5.0
DROP_WINDOW_S = 120          # trailing window for the FAST rate (theft/refuel)
LEAK_WINDOW_S = 40 * 60      # trailing window for the SLOW rate (leak) -- leak's
                             # signal is small and only separates from sensor/
                             # sloshing-residual noise once averaged over a much
                             # longer window than theft needs (see comment in
                             # _stage_cd_classify)
BASELINE_WINDOW_S = 2 * 3600  # max samples kept in the causal "normal" baseline
MIN_HISTORY_S = 600           # need at least this much Normal history before scoring
LEAK_MIN_HISTORY = 6          # slow-rate baseline needs far fewer *samples*
                              # since each one already averages 40 min

REFUEL_RATE_LPM = 20.0        # level RISING faster than this (L/min)
REFUEL_MIN_LITERS = 15.0      # ignore tiny blips
THEFT_RATE_LPM = 5.0          # level FALLING faster than this while stationary
LEAK_EXCESS_LPM = 0.4         # sustained excess drop above baseline
THEFT_PERSIST_S = 60          # must hold this long to CONFIRM
LEAK_PERSIST_S = 10 * 60      # shorter than before -- the slow rate itself
                               # already averages 40 min, so less extra
                               # persistence is needed to avoid one-off blips
THEFT_Z = 3.0                 # z-score confidence bar
LEAK_Z = 2.0
DATA_GAP_S = 15 * 60          # gaps longer than this => "Unverified"


# ---------------------------------------------------------------
# Stage A: motion, stationary-duration, geofence
# ---------------------------------------------------------------
def _haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlmb = np.radians(lon2 - lon1)
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 2 * R * np.arcsin(np.sqrt(a))


def _stage_a_motion_geofence(df, stations):
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["moving"] = df["speed_kmph"] > MOVING_SPEED_KMPH

    # GPS-displacement cross-check (helps when speed_kmph is missing/noisy):
    # flag "moving" also if the vehicle displaced > ~15 m since the last row.
    lat2, lon2 = df["latitude"].shift(1), df["longitude"].shift(1)
    disp_m = _haversine_m(df["latitude"], df["longitude"], lat2, lon2).fillna(0)
    df["moving"] = df["moving"] | (disp_m > 15)

    # stationary_since: NaT while moving; first stationary timestamp otherwise
    stationary_since = []
    stationary_start_fuel = []
    cur_since = None
    cur_start_fuel = None
    fuel = df["fuel_level"].to_numpy()
    for i, (moving, ts) in enumerate(zip(df["moving"], df["timestamp"])):
        if moving:
            cur_since = None
            cur_start_fuel = None
        elif cur_since is None:
            cur_since = ts
            cur_start_fuel = fuel[i]
        stationary_since.append(cur_since)
        stationary_start_fuel.append(cur_start_fuel)
    df["stationary_since"] = stationary_since
    df["stationary_s"] = (df["timestamp"] - df["stationary_since"]).dt.total_seconds().fillna(0)
    # Total volume risen since this stationary stop began -- lets Stage D
    # require a minimum total refuel size, not just an instantaneous rate.
    df["rise_since_stationary_L"] = df["fuel_level"] - pd.Series(stationary_start_fuel, index=df.index).fillna(df["fuel_level"])

    # Geofence: distance (m) to nearest known fuel station
    dists = np.vstack([
        _haversine_m(df["latitude"].to_numpy(), df["longitude"].to_numpy(), s.lat, s.lon)
        for s in stations.itertuples()
    ])
    min_dist = dists.min(axis=0)
    radii = stations["radius_m"].to_numpy()[dists.argmin(axis=0)]
    df["at_station"] = min_dist <= radii
    return df


# ---------------------------------------------------------------
# Stage B: elapsed-time-based drop-rate (baseline itself now lives in
# Stage C/D below, because it must be causal AND self-protecting -- see
# _RunningBaseline docstring)
# ---------------------------------------------------------------
def _stage_b_rates(df):
    ts = df["timestamp"].to_numpy()
    fuel = df["fuel_level"].to_numpy()
    n = len(df)

    def trailing_rate(window_s):
        rate = np.zeros(n)
        j = 0
        for i in range(n):
            while (ts[i] - ts[j]) / np.timedelta64(1, "s") > window_s:
                j += 1
            dt_min = (ts[i] - ts[j]) / np.timedelta64(1, "m")
            rate[i] = (fuel[j] - fuel[i]) / dt_min if dt_min > 0 else 0.0
        return rate

    df["drop_rate_Lpm"] = trailing_rate(DROP_WINDOW_S)          # fast: theft/refuel
    df["drop_rate_slow_Lpm"] = trailing_rate(LEAK_WINDOW_S)     # slow: leak

    # Data-gap flag: elapsed time since the previous received row
    gap_s = df["received_at"].diff().dt.total_seconds().fillna(0)
    df["data_gap"] = gap_s > DATA_GAP_S
    return df


# ---------------------------------------------------------------
# Stage C + D: rule-based candidates -> statistically confirmed status
# ---------------------------------------------------------------
def _persisted(mask, i, seconds, ts):
    """True if `mask` has been continuously True for at least `seconds`
    ending at row i (walks backward using real elapsed time)."""
    if not mask[i]:
        return False
    j = i
    while j > 0 and mask[j - 1] and (ts[i] - ts[j - 1]) / np.timedelta64(1, "s") <= seconds * 1.5:
        j -= 1
    return (ts[i] - ts[j]) / np.timedelta64(1, "s") >= seconds


class _RunningBaseline:
    """A per-motion-state 'what does normal look like' model, updated ONLY
    from samples the algorithm itself has already classified as Normal.

    This is the fix for a real bug found by inspecting actual results: a
    plain trailing rolling mean/std over ALL drop-rate values (including
    ongoing anomalies) lets a multi-hour leak or theft absorb itself into
    its own reference distribution -- once "normal" has quietly drifted to
    include the leak, the z-score for that same leak collapses toward
    zero, and it never confirms. By only ever feeding back rows that were
    themselves Normal, a long-running anomaly can no longer contaminate
    the yardstick used to detect it.

    Bounded with a deque (default 3600 Normal samples, i.e. up to ~1 hour
    of Normal history at 1 Hz) with O(1) running sum/sum-of-squares so this
    stays cheap per row -- exactly how you'd implement it as incremental
    state in a real streaming/edge-function context, not a batch rolling
    window recomputed from scratch."""

    def __init__(self, maxlen=3600):
        self.buf = deque(maxlen=maxlen)
        self.sum = 0.0
        self.sumsq = 0.0

    def z(self, x, min_samples):
        n = len(self.buf)
        if n < min_samples:
            return 0.0, False
        mean = self.sum / n
        var = max(self.sumsq / n - mean ** 2, 1e-9)
        std = var ** 0.5
        if std < 1e-6:
            return 0.0, True
        return (x - mean) / std, True

    def push(self, x):
        if len(self.buf) == self.buf.maxlen:
            old = self.buf.popleft()
            self.sum -= old
            self.sumsq -= old * old
        self.buf.append(x)
        self.sum += x
        self.sumsq += x * x


def _stage_cd_classify(df):
    n = len(df)
    status = np.full(n, "Normal", dtype=object)
    z_out = np.zeros(n)
    z_leak_out = np.zeros(n)
    dr = df["drop_rate_Lpm"].to_numpy()          # fast rate: theft/refuel
    dr_slow = df["drop_rate_slow_Lpm"].to_numpy()  # slow rate: leak
    moving = df["moving"].to_numpy()
    at_station = df["at_station"].to_numpy()
    data_gap = df["data_gap"].to_numpy()
    rise_since_stationary = df["rise_since_stationary_L"].to_numpy()
    ts = df["timestamp"].to_numpy()

    theft_persist_mask = dr > THEFT_RATE_LPM
    leak_persist_mask = dr_slow > LEAK_EXCESS_LPM

    baseline_moving = _RunningBaseline(maxlen=int(BASELINE_WINDOW_S))
    baseline_stationary = _RunningBaseline(maxlen=int(BASELINE_WINDOW_S))
    # Leak's baseline runs on the SLOW rate, not split by instantaneous
    # motion state: each sample already averages 40 min, which typically
    # spans both driving and idling, so "current motion state" doesn't
    # meaningfully characterize it the way it does for the fast rate.
    baseline_leak = _RunningBaseline(maxlen=200)
    min_samples = max(1, int(MIN_HISTORY_S))

    for i in range(n):
        baseline = baseline_moving if moving[i] else baseline_stationary
        z, has_baseline = baseline.z(dr[i], min_samples)
        z_out[i] = z
        z_leak, has_leak_baseline = baseline_leak.z(dr_slow[i], LEAK_MIN_HISTORY)
        z_leak_out[i] = z_leak

        if data_gap[i]:
            status[i] = "Unverified - data gap"
            continue

        if not moving[i] and dr[i] < -REFUEL_RATE_LPM:
            if at_station[i] and rise_since_stationary[i] >= REFUEL_MIN_LITERS:
                status[i] = "Refuel (confirmed)"
            elif at_station[i]:
                status[i] = "Refuel (in progress)"
            else:
                status[i] = "Anomalous rise - review"
        elif not moving[i] and not at_station[i] and dr[i] > THEFT_RATE_LPM:
            # Theft's absolute-rate threshold + stationary + off-station context
            # is already a highly specific combination, so persistence alone
            # confirms it; z-score is a CONFIDENCE tag, not a hard gate, so a
            # concurrent contaminating anomaly can't suppress a real theft.
            candidate = _persisted(theft_persist_mask, i, THEFT_PERSIST_S, ts) and not moving[i]
            if candidate:
                high_conf = has_baseline and z > THEFT_Z
                status[i] = "Theft (confirmed" + (", high-confidence)" if high_conf else ")")
            else:
                status[i] = "Theft (under watch)"
        elif dr_slow[i] > LEAK_EXCESS_LPM:
            # Leak's threshold is deliberately low/sensitive, so it DOES need
            # the z-score gate to avoid firing on ordinary driving variation --
            # safe now because (a) the baseline can no longer absorb the leak
            # (self-protecting push-only-if-Normal design) and (b) it's scored
            # on a 40-min-averaged rate where the leak's small, sustained
            # excess is actually visible above sensor/sloshing-residual noise,
            # instead of a 2-min window where that noise swamps it.
            candidate = _persisted(leak_persist_mask, i, LEAK_PERSIST_S, ts)
            confirmed = candidate and has_leak_baseline and z_leak > LEAK_Z
            status[i] = "Leak (confirmed)" if confirmed else ("Leak (under watch)" if candidate else "Normal")
        else:
            status[i] = "Normal"

        if status[i] == "Normal":
            baseline.push(dr[i])
            baseline_leak.push(dr_slow[i])

    df["drop_z"] = z_out
    df["drop_z_leak"] = z_leak_out
    df["status"] = status
    return df


# ---------------------------------------------------------------
# Stage E: consolidate consecutive confirmed rows into events
# ---------------------------------------------------------------
def _stage_e_events(df):
    event_id = np.full(len(df), -1, dtype=int)
    cur_id = -1
    cur_label = None
    next_id = 0
    for i, lab in enumerate(df["status"]):
        base_label = lab.split(" (")[0]
        is_event = "confirmed" in lab or "under watch" in lab or "review" in lab or "in progress" in lab
        if is_event and base_label == cur_label:
            event_id[i] = cur_id
        elif is_event:
            cur_id = next_id
            next_id += 1
            cur_label = base_label
            event_id[i] = cur_id
        else:
            cur_label = None
    df["event_id"] = np.where(event_id >= 0, event_id, np.nan)
    return df


def classify(df, stations=DEFAULT_STATIONS):
    """Main entry point. df must contain the Supabase telemetry columns
    (already timestamp-parsed as datetime). Returns df with `status` and
    `event_id` columns added."""
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["received_at"] = pd.to_datetime(df["received_at"])
    df = _stage_a_motion_geofence(df, stations)
    df = _stage_b_rates(df)
    df = _stage_cd_classify(df)
    df = _stage_e_events(df)
    return df


def summarize_events(df):
    """Collapse per-row output into one row per event."""
    rows = []
    for eid, g in df[df["event_id"].notna()].groupby("event_id"):
        rows.append({
            "event_id": int(eid),
            "status": g["status"].iloc[-1],
            "start": g["timestamp"].iloc[0],
            "end": g["timestamp"].iloc[-1],
            "duration_s": (g["timestamp"].iloc[-1] - g["timestamp"].iloc[0]).total_seconds(),
            "fuel_change_L": float(g["fuel_level"].iloc[-1] - g["fuel_level"].iloc[0]),
            "lat": g["latitude"].iloc[0], "lon": g["longitude"].iloc[0],
        })
    return pd.DataFrame(rows)
