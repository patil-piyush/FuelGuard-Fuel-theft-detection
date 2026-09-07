"""
run_simulation.py
------------------
Runs the full simulated pipeline end-to-end, matching your real architecture:

  1. generate_data.py  -> raw, sloshing-corrupted sensor stream (on-vehicle)
  2. edge_firmware.py  -> ESP32-side IIR filtering -> supabase_telemetry.csv
                          (this is the only file that matches your real
                          Supabase schema; ground truth is kept in a
                          separate _debug file for scoring purposes only)
  3. cloud_algo.classify() -> the real theft/leak/refuel algorithm, reading
                          ONLY the Supabase schema columns
  4. Score cloud_algo's output against ground truth, compare against the
     naive "before" baseline (raw signal, fixed threshold, no fusion)
  5. Save plots + results_summary.json

Run: python3 generate_data.py && python3 run_simulation.py
(edge_firmware.py is invoked automatically by this script)
"""
import json
import subprocess
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from pipeline import iir_filter, fir_filter, classify_naive
import cloud_algo

pd.set_option("display.width", 140)

# ---------------------------------------------------------------
# Step 2: run the edge firmware simulation (IIR filter + write Supabase csv)
# ---------------------------------------------------------------
subprocess.run(["python3", "edge_firmware.py"], check=True, cwd="/home/claude/sim")

telemetry = pd.read_csv("/home/claude/sim/supabase_telemetry.csv",
                         parse_dates=["timestamp", "received_at"])
debug = pd.read_csv("/home/claude/sim/supabase_telemetry_debug.csv",
                     parse_dates=["timestamp", "received_at"])

# ---------------------------------------------------------------
# Fuel-level estimation accuracy: fuel_level (post-edge-IIR) vs ground truth,
# vs. what raw/FIR would have looked like had edge filtering not been done.
# ---------------------------------------------------------------
debug["fuel_fir_L"] = fir_filter(debug["fuel_raw_L"].to_numpy(), order=50)

def q_metric(gt, est):
    return 100 * (1 - np.abs(gt - est) / np.maximum(gt, 1e-6))

# Checkpoints: last row before each refuel event begins
refuel_starts = debug.index[(debug["event_label"] == "Refuel") &
                             (debug["event_label"].shift(1) != "Refuel")]
CKPT_WINDOW = 60
rows = []
for name, col in [("Raw (no edge filtering)", "fuel_raw_L"),
                   ("FIR order 50", "fuel_fir_L"),
                   ("fuel_level (edge IIR order 10)", "fuel_level")]:
    errs, qs = [], []
    for c in refuel_starts:
        c = max(c - 1, 0)
        est_val = debug[col].iloc[max(0, c - CKPT_WINDOW + 1): c + 1].mean()
        gt_val = debug["fuel_gt_L"].iloc[c]
        errs.append(abs(gt_val - est_val))
        qs.append(q_metric(gt_val, est_val))
    rmse = float(np.sqrt(np.mean((debug["fuel_gt_L"] - debug[col]) ** 2)))
    rows.append({"Signal": name, "Mean error at refuel (L)": float(np.mean(errs)),
                 "Q accuracy (%)": float(np.mean(qs)), "Overall RMSE (L)": rmse})
accuracy_table = pd.DataFrame(rows)
print("\n=== Fuel-level estimation accuracy ===")
print(accuracy_table.to_string(index=False))

# ---------------------------------------------------------------
# Step 3: run the real cloud algorithm on the Supabase-schema data only
# ---------------------------------------------------------------
classified = cloud_algo.classify(telemetry)
events = cloud_algo.summarize_events(classified)
print(f"\n=== cloud_algo detected {len(events)} events ===")
if len(events):
    print(events.to_string(index=False))

# Naive baseline (raw signal, fixed threshold, no GPS/motion) for comparison
debug["label_naive"] = classify_naive(debug)

# Align classified (may have fewer rows due to simulated packet loss) back
# onto the debug/ground-truth index via timestamp for scoring.
merged = debug.merge(classified[["timestamp", "status"]], on="timestamp", how="left")
merged["status"] = merged["status"].fillna("Normal")

def event_windows(label_series, t_s, base_label_fn=lambda s: s):
    events, cur = [], None
    for lab, tt in zip(label_series, t_s):
        base = base_label_fn(lab)
        if base != "Normal":
            if cur and cur["label"] == base and tt - cur["end"] <= 15:
                cur["end"] = tt
            else:
                if cur:
                    events.append(cur)
                cur = {"label": base, "start": tt, "end": tt}
        else:
            if cur:
                events.append(cur)
                cur = None
    if cur:
        events.append(cur)
    return events

def _proposed_label(s):
    if s.startswith("Theft") and "confirmed" in s:
        return "Theft"
    if s.startswith("Leak"):  # count both "confirmed" and "under watch"
        return "Leak"
    if s.startswith("Refuel") and "confirmed" in s:
        return "Refuel"
    return "Normal"

gt_events = event_windows(merged["event_label"], merged["t_s"])
proposed_events = event_windows(merged["status"], merged["t_s"], _proposed_label)
naive_events = event_windows(merged["label_naive"], merged["t_s"])

def score_detector(detected_events, gt_events, target_labels=("Theft",)):
    gt_t = [e for e in gt_events if e["label"] in target_labels]
    det_t = [e for e in detected_events if e["label"] in target_labels]
    tp, matched = 0, set()
    for de in det_t:
        for gi, ge in enumerate(gt_t):
            if gi in matched:
                continue
            if de["start"] <= ge["end"] and de["end"] >= ge["start"]:
                tp += 1
                matched.add(gi)
                break
    fp = len(det_t) - tp
    fn = len(gt_t) - tp
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return dict(TP=tp, FP=fp, FN=fn, Precision=round(precision, 3), Recall=round(recall, 3), F1=round(f1, 3))

proposed_theft_score = score_detector(proposed_events, gt_events, ("Theft",))
naive_theft_score = score_detector(naive_events, gt_events, ("Theft",))
proposed_leak_score = score_detector(proposed_events, gt_events, ("Leak",))

def false_alarm_count(label_series, gt_series, positive_check):
    return int(np.sum(positive_check(label_series) & (gt_series != "Theft")))

proposed_fa = false_alarm_count(merged["status"].to_numpy(), merged["event_label"].to_numpy(),
                                 lambda s: np.char.startswith(s.astype(str), "Theft (confirmed"))
naive_fa = false_alarm_count(merged["label_naive"].to_numpy(), merged["event_label"].to_numpy(),
                              lambda s: s == "Theft")

print("\n=== Theft-detection performance ===")
comparison = pd.DataFrame([
    {"Method": "Naive (raw signal, fixed threshold, no GPS/motion)", **naive_theft_score, "False-positive samples": naive_fa},
    {"Method": "Proposed (cloud_algo: edge-IIR + GPS/motion + geofence + z-score)", **proposed_theft_score, "False-positive samples": proposed_fa},
])
print(comparison.to_string(index=False))

print("\n=== Leak-detection performance (cloud_algo only -- naive baseline has no leak logic) ===")
print(pd.DataFrame([{"Method": "Proposed (cloud_algo, slow-rate + z-score)", **proposed_leak_score}]).to_string(index=False))

# ---------------------------------------------------------------
# Save results summary
# ---------------------------------------------------------------
summary = {
    "accuracy_table": accuracy_table.to_dict(orient="records"),
    "detection_comparison": comparison.to_dict(orient="records"),
    "leak_detection": proposed_leak_score,
    "events_detected": events.to_dict(orient="records") if len(events) else [],
    "ground_truth_events": [{"label": e["label"], "start_s": e["start"], "end_s": e["end"]} for e in gt_events],
}
with open("/home/claude/sim/results_summary.json", "w") as f:
    json.dump(summary, f, indent=2, default=str)
print("\nSaved -> results_summary.json")

# ---------------------------------------------------------------
# Plots
# ---------------------------------------------------------------
NAVY, BLUE, TEAL, AMBER, RED, GREY = "#1B2A4A", "#2E5EAA", "#1B7F79", "#C97A20", "#A5312A", "#8892A0"

fig, axes = plt.subplots(3, 1, figsize=(12, 11), sharex=True,
                          gridspec_kw={"height_ratios": [2.2, 1.2, 1.2]})

t_h = debug["t_s"] / 3600.0
ax = axes[0]
ax.plot(t_h, debug["fuel_raw_L"], color=GREY, lw=0.5, alpha=0.6, label="Raw (pre-edge, sloshing-corrupted)")
ax.plot(t_h, debug["fuel_gt_L"], color=NAVY, lw=2.2, label="Ground truth")
ax.plot(t_h, debug["fuel_level"], color=AMBER, lw=1.6, label="fuel_level (post-edge IIR, in Supabase)")
for e in gt_events:
    color = {"Theft": RED, "Refuel": TEAL, "Leak": BLUE}.get(e["label"])
    if color:
        ax.axvspan(e["start"] / 3600, max(e["end"], e["start"] + 60) / 3600, color=color, alpha=0.15)
ax.set_ylabel("Fuel (L)")
ax.set_title("Simulated trip: raw vs. edge-filtered fuel_level vs. ground truth", fontsize=12, color=NAVY)
ax.legend(loc="upper right", fontsize=9)

merged_sorted = merged.merge(classified[["timestamp", "drop_rate_Lpm"]], on="timestamp", how="left").sort_values("t_s")
ax = axes[1]
ax.plot(merged_sorted["t_s"] / 3600, merged_sorted["drop_rate_Lpm"], color=BLUE, lw=0.8)
ax.axhline(THEFT_RATE_LPM if (THEFT_RATE_LPM := cloud_algo.THEFT_RATE_LPM) else 5, color=RED, ls="--", lw=1, label="Theft threshold")
ax.axhline(cloud_algo.LEAK_EXCESS_LPM, color=AMBER, ls="--", lw=1, label="Leak threshold")
ax.set_ylabel("Drop rate (L/min)")
ax.set_title("Drop-rate signal used by cloud_algo (computed from fuel_level)", fontsize=11, color=NAVY)
ax.legend(loc="upper right", fontsize=8)

ax = axes[2]
naive_flag = (merged_sorted["label_naive"] == "Theft").astype(int)
proposed_flag = merged_sorted["status"].astype(str).str.startswith("Theft (confirmed").astype(int) * 0.5
ax.fill_between(merged_sorted["t_s"] / 3600, 0, naive_flag, step="mid", color=RED, alpha=0.5, label="Naive: flagged Theft")
ax.fill_between(merged_sorted["t_s"] / 3600, 0, proposed_flag, step="mid", color=TEAL, alpha=0.8, label="cloud_algo: Theft (confirmed)")
ax.set_ylim(0, 1.1)
ax.set_yticks([])
ax.set_xlabel("Time (hours)")
ax.set_title("Detected theft flags: naive baseline vs. cloud_algo", fontsize=11, color=NAVY)
ax.legend(loc="upper right", fontsize=8)

plt.tight_layout()
plt.savefig("/home/claude/sim/fig_trip_overview.png", dpi=170, facecolor="white")
print("Saved -> fig_trip_overview.png")

# Zoomed plot around Theft event 1
fig2, ax2 = plt.subplots(figsize=(9, 4.5))
mask = (debug["t_s"] >= 3300) & (debug["t_s"] <= 4200)
ax2.plot(debug["t_s"][mask] / 60, debug["fuel_raw_L"][mask], color=GREY, lw=0.8, label="Raw (pre-edge)")
ax2.plot(debug["t_s"][mask] / 60, debug["fuel_gt_L"][mask], color=NAVY, lw=2, label="Ground truth")
ax2.plot(debug["t_s"][mask] / 60, debug["fuel_level"][mask], color=AMBER, lw=1.8, label="fuel_level (post-edge IIR)")
ax2.axvspan(3600 / 60, 3900 / 60, color=RED, alpha=0.15, label="Theft event window")
ax2.set_xlabel("Time (minutes)")
ax2.set_ylabel("Fuel (L)")
ax2.set_title("Zoom: Theft Event 1 -- sloshing noise vs. edge-filtered signal", color=NAVY)
ax2.legend(fontsize=9)
plt.tight_layout()
plt.savefig("/home/claude/sim/fig_theft_zoom.png", dpi=170, facecolor="white")
print("Saved -> fig_theft_zoom.png")
