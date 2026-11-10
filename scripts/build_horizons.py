"""Offline: DEM -> horizon profiles (data/horizons.json).

usage: python scripts/build_horizons.py path/to/lola_south_pole_dem.tif [--step 120] [--max-km 150]

Sites outside the DEM get a flat horizon and are marked as such.
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunanav.horizon import HorizonProfile, compute_horizon, dem_sampler, save_profiles  # noqa: E402
from lunanav.sites import load_sites  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument("dem")
ap.add_argument("--step", type=float, default=120.0, help="ray step in meters (~DEM resolution)")
ap.add_argument("--max-km", type=float, default=150.0)
ap.add_argument("--out", default=str(ROOT / "data" / "horizons.json"))
args = ap.parse_args()

sample = dem_sampler(args.dem)
profiles = []
for s in load_sites():
    try:
        p = compute_horizon(sample, s.id, s.lat, s.lon, step_m=args.step,
                            max_distance_m=args.max_km * 1000, source=Path(args.dem).name)
        print(f"{s.id:22s} max horizon {max(p.elevations_deg):5.2f} deg")
    except ValueError as e:
        print(f"{s.id:22s} outside DEM -> flat horizon ({e})")
        p = HorizonProfile.flat(s.id, s.lat, s.lon)
    profiles.append(p)
save_profiles(profiles, args.out)
print("wrote", args.out)
