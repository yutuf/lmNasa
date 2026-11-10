"""SYNTHETIC data for UI development only. Not physically accurate.

Generates data/series/<site>.npz with toy Sun/Earth tracks so the app can be
built before kernels/DEM are ready. Real data: scripts/precompute.py (overwrites these).
"""
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from lunanav.geometry import disk_visible_fraction  # noqa: E402
from lunanav.sites import load_sites  # noqa: E402

out = ROOT / "data" / "series"
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(0)
t = np.arange(np.datetime64("2027-01-01T00:00:00"), np.datetime64("2027-07-01T00:00:00"),
              np.timedelta64(1, "h"))
h = np.arange(len(t), dtype=float)
SYNODIC_H, SIDEREAL_H, YEAR_H = 29.53 * 24, 27.32 * 24, 365.25 * 24

for s in load_sites():
    colat = 90 - abs(s.lat)                       # pole distance in degrees
    phase = 2 * np.pi * h / SYNODIC_H + rng.uniform(0, 2 * np.pi)
    sun_az = np.degrees(phase) % 360
    declination = 1.54 * np.sin(2 * np.pi * h / YEAR_H)
    if abs(s.lat) > 80:   # polar: Sun circles the horizon, altitude ~ +/- (colat) + declination
        sun_alt = colat * np.cos(phase) * 0.5 - declination
    else:                 # equatorial: ~14.8-day day/night cycle
        sun_alt = (90 - colat * 0 - abs(s.lat)) * np.sin(phase)
    earth_az = (0 + 7 * np.sin(2 * np.pi * h / SIDEREAL_H)) % 360   # libration wobble
    earth_alt = (colat if abs(s.lat) > 80 else 90 - abs(s.lat) - 30) \
        - 6.7 * np.sin(2 * np.pi * h / SIDEREAL_H + 1)
    bumps = rng.uniform(0, 2.5, 8)
    hz = lambda az: np.interp(az % 360, np.linspace(0, 360, 9), np.r_[bumps, bumps[0]])  # noqa: E731
    sun_h, earth_h = hz(sun_az), hz(earth_az)
    np.savez_compressed(
        out / f"{s.id}.npz", times=t.astype("int64"), step_h=1.0,
        sun_alt=sun_alt, sun_az=sun_az, sun_horizon=sun_h,
        sun_fraction=disk_visible_fraction(sun_alt, sun_h, 0.267),
        earth_alt=earth_alt, earth_az=earth_az, earth_horizon=earth_h,
        earth_visible=earth_alt > earth_h, terrain="SYNTHETIC DEMO DATA",
    )
    print("synthetic", s.id)
