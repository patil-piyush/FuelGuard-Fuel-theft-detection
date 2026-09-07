"""
pipeline.py
-----------
Two things live here now that the real classification logic has moved to
cloud_algo.py:

  1. iir_filter() / fir_filter() -- the edge-side filters. iir_filter() is
     what edge_firmware.py runs ON THE ESP32 to turn the raw, sloshing-
     corrupted pressure-probe signal into the `fuel_level` value that
     actually gets written to Supabase.

  2. classify_naive() -- a bare drop-rate threshold on the RAW (unfiltered)
     signal with NO GPS/motion/geofence correlation, standing in for the
     Section IV-A literature (Rows 1, 3, 5, 6, 19). Used only as the
     "before" comparison against cloud_algo.classify() in run_simulation.py.
"""
import numpy as np
from scipy.signal import butter, sosfilt, sosfilt_zi

FS = 1.0  # Hz

# ---------------------------------------------------------------
# Edge-side filtering (runs on the ESP32)
# ---------------------------------------------------------------
def iir_filter(raw, order=10, cutoff_hz=0.02):
    """Causal Butterworth low-pass filter (real-time / streaming compatible,
    i.e. it only uses past samples -- exactly what an ESP32 running this
    filter sample-by-sample would produce).
    order=10 reproduces the best-performing configuration identified in
    Biernacki & Libal (2025).
    Implemented in second-order-sections (SOS) form rather than raw (b, a)
    transfer-function coefficients: at order 10 the direct-form coefficients
    become numerically ill-conditioned and the filter blows up, which is a
    well-known numerical-stability pitfall of high-order IIR design -- SOS
    avoids it and is also how you'd want to implement it on the ESP32 itself.
    The filter's internal state is primed with the first sample (zi * raw[0])
    instead of zero, exactly as a real streaming implementation should boot
    from the first reading rather than from an assumed empty tank -- without
    this, a slow, high-order filter shows a long, misleading start-up
    transient."""
    sos = butter(order, cutoff_hz / (FS / 2), btype="low", output="sos")
    zi = sosfilt_zi(sos) * raw[0]
    out, _ = sosfilt(sos, raw, zi=zi)
    return out


def fir_filter(raw, order=50):
    """Moving-average FIR filter, included only as the paper's comparison
    baseline (FIR order 50 was their best FIR result)."""
    kernel = np.ones(order) / order
    return np.convolve(raw, kernel, mode="full")[: len(raw)]


# ---------------------------------------------------------------
# "Before" baseline for comparison: raw signal, fixed threshold, no fusion
# ---------------------------------------------------------------
def classify_naive(df, raw_col="fuel_raw_L", threshold_Lpm=5.0, window_s=120):
    raw = df[raw_col].to_numpy()
    labels = np.full(len(df), "Normal", dtype=object)
    for i in range(len(raw)):
        j = max(0, i - window_s)
        dt_min = (i - j) / 60.0 if i > j else 1e-6
        rate = (raw[j] - raw[i]) / dt_min
        if rate > threshold_Lpm:
            labels[i] = "Theft"
    return labels
