"""Offline: sky tracks + visibility for every site -> data/series/<site>.npz.

usage: python scripts/precompute.py --start 2027-01-01 --end 2028-01-01 [--step-h 1]

The app reads these npz files, so it needs neither kernels nor the DEM at runtime.
"""
import argparse
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunanav.ephemeris import MoonSky  # noqa: E402
from lunanav.horizon import HorizonProfile, load_profiles  # noqa: E402
from lunanav.sites import load_sites  # noqa: E402
from lunanav.visibility import compute_visibility  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("--start", default="2027-01-01")
ap.add_argument("--end", default="2028-01-01")
ap.add_argument("--step-h", type=float, default=1.0)
args = ap.parse_args()

hz_path = ROOT / "data" / "horizons.json"
horizons = load_profiles(hz_path) if hz_path.exists() else {}
sky = MoonSky()
out = ROOT / "data" / "series"
out.mkdir(parents=True, exist_ok=True)

for s in load_sites():
    hz = horizons.get(s.id) or HorizonProfile.flat(s.id, s.lat, s.lon)
    tr = sky.track(s.lat, s.lon, args.start, args.end, args.step_h, height_m=2.0)
    v = compute_visibility(tr, hz)
    np.savez_compressed(
        out / f"{s.id}.npz",
        times=v.times_utc.astype("datetime64[s]").astype("int64"),
        step_h=args.step_h,
        sun_alt=v.sun_alt.astype("float32"), sun_az=v.sun_az.astype("float32"),
        sun_horizon=v.sun_horizon.astype("float32"), sun_fraction=v.sun_fraction.astype("float32"),
        earth_alt=v.earth_alt.astype("float32"), earth_az=v.earth_az.astype("float32"),
        earth_horizon=v.earth_horizon.astype("float32"), earth_visible=v.earth_visible,
        terrain=hz.source,
    )
    print(f"{s.id:22s} sun>=50% {np.mean(v.sun_fraction >= .5):5.1%}  earth {v.earth_visible.mean():5.1%}")
print("wrote", out)
