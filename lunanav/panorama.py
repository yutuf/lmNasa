"""Helpers for the 360° horizon panorama (pure numpy, no plotting)."""
from __future__ import annotations

import numpy as np

COMPASS = {0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW"}


def circular_mean_deg(az_deg) -> float:
    a = np.radians(np.asarray(az_deg, dtype=float))
    return float(np.degrees(np.arctan2(np.sin(a).mean(), np.cos(a).mean())) % 360.0)


def unwrap_about(az_deg, center_deg: float):
    """Map azimuths into [center-180, center+180) so the view is centred on `center`."""
    return center_deg + ((np.asarray(az_deg, dtype=float) - center_deg + 180.0) % 360.0 - 180.0)


def break_at_wraps(x, *ys, jump: float = 180.0):
    """Insert NaN where x jumps by more than `jump` so plotted lines do not
    streak across the whole panorama when a track crosses the view edge."""
    x = np.asarray(x, dtype=float)
    cut = np.flatnonzero(np.abs(np.diff(x)) > jump) + 1
    out_x = np.insert(x, cut, np.nan)
    out_ys = [np.insert(np.asarray(y, dtype=float), cut, np.nan) for y in ys]
    return (out_x, *out_ys)


def compass_ticks(lo: float, hi: float, step: int = 45):
    """Tick positions in [lo, hi] at multiples of `step`, labelled N/NE/E/..."""
    first = int(np.ceil(lo / step) * step)
    vals = list(range(first, int(np.floor(hi)) + 1, step))
    return vals, [COMPASS.get(v % 360, f"{v % 360}°") for v in vals]
