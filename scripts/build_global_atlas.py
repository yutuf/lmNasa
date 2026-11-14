"""Terrain horizons for the whole Moon: the input of the web search engine's "Whole Moon" scope.

  python scripts/build_global_atlas.py                    # ~41,000 points, 1 deg rows, 72 azimuths; minutes

The south-pole atlas (build_horizon_atlas.py) is a 2 km grid on a 200 m terrain map; this one covers every latitude
with points about 30 km apart: rows every 1 deg of latitude, and along each row a longitude step of 1 deg / cos(lat)
so the spacing stays roughly even. Each point gets its horizon in 72 directions (5 deg), ray-marched over the LOLA
global grid (LDEM_16, about 1.9 km per pixel, data/global_grid.npz) out to 150 km from a 2 m mast, plus its height and
the slope over a 2 km baseline. Coarser than the pole atlas, honest about it in the app.

Written to web/public/data/global_atlas.bin (little-endian):
  header: uint32 n_points, uint16 n_az
  int16  lat_deg * 100, int16 lon_deg * 100 (-180..180)      (n_points each)
  int16  height_m                                              (n_points)
  uint8  slope_deg * 4                                         (n_points)
  uint8  horizon (deg + 8) * 10, azimuths 0, 5, ..., 355 clockwise from local north   (n_points * n_az)
"""
import argparse
import struct
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lunanav.anywhere import GlobalGrid  # noqa: E402
from lunanav.horizon import compute_horizon  # noqa: E402

R = 1737400.0
_grid = None


def _init():
    global _grid
    _grid = GlobalGrid.load()


def _one(args):
    lat, lon, n_az = args
    hz = compute_horizon(_grid.sample_height, "global", lat, lon, n_azimuths=n_az, step_m=1000.0, min_distance_m=1500.0)
    d = np.degrees(1000.0 / R)                               # 1 km in degrees of latitude
    dl = d / max(np.cos(np.radians(lat)), 0.02)
    la = np.array([lat + d, lat - d, lat, lat, lat])
    lo = np.array([lon, lon, lon + dl, lon - dl, lon])
    h = _grid.sample_height(la, lo)
    slope = np.degrees(np.arctan(np.hypot((h[0] - h[1]) / 2000.0, (h[2] - h[3]) / 2000.0)))
    return np.array(hz.elevations_deg, dtype=np.float32), float(h[4]), float(slope)


def points(step_deg=1.0):
    out = []
    for lat in np.arange(-90 + step_deg / 2, 90, step_deg):
        dlon = step_deg / max(np.cos(np.radians(lat)), step_deg / 30)
        n = max(4, int(round(360 / dlon)))
        for k in range(n):
            out.append((float(lat), float(-180 + (k + 0.5) * 360 / n)))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--step-deg", type=float, default=1.0)
    ap.add_argument("--n-az", type=int, default=72)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    pts = points(args.step_deg)
    print(f"{len(pts)} points, {args.n_az} azimuths, {args.workers} workers", flush=True)
    t0 = time.time()
    with Pool(args.workers, initializer=_init) as pool:
        res = pool.map(_one, [(la, lo, args.n_az) for la, lo in pts], chunksize=128)
    print(f"traced in {time.time() - t0:.0f} s", flush=True)
    hz = np.vstack([r[0] for r in res])
    lat = np.array([p[0] for p in pts]); lon = np.array([p[1] for p in pts])
    out = ROOT / "web" / "public" / "data" / "global_atlas.bin"
    with open(out, "wb") as f:
        f.write(struct.pack("<IH", len(pts), args.n_az))
        f.write(np.round(lat * 100).astype("<i2").tobytes())
        f.write(np.round(lon * 100).astype("<i2").tobytes())
        f.write(np.round([r[1] for r in res]).astype("<i2").tobytes())
        f.write(np.clip(np.round(np.array([r[2] for r in res]) * 4), 0, 255).astype("u1").tobytes())
        f.write(np.clip(np.round((hz + 8.0) * 10.0), 0, 255).astype("u1").tobytes())
    print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB); horizon {hz.min():.1f}..{hz.max():.1f} deg; "
          f"median horizon {np.median(hz):.2f} deg; slope median {np.median([r[2] for r in res]):.1f} deg")


if __name__ == "__main__":
    main()
