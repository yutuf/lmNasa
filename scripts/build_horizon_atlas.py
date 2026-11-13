"""Terrain horizons for every candidate landing point near the south pole: the input of the web search engine.

  python scripts/build_horizon_atlas.py                 # 2 km grid out to 84.5 S, ~22,000 points, a few minutes

For each point of a square grid in the south-polar stereographic plane (inside 84.5 S) the horizon is traced
from the compact LOLA grid (data/polar_grid.npz, 200 m / 800 m) out to 150 km from a 2 m mast, at 2 deg azimuth
steps, plus the ground height and the slope over a 400 m baseline. Written to web/public/data/atlas.bin:

  header (little-endian): uint32 n_points, uint16 n_az, float32 spacing_m, float32 r_max_m
  int16  x_km*10, y_km*10     (n_points each; stereographic, +x toward 90 E, +y toward 0 E)
  int16  height_m             (n_points)
  uint8  slope_deg*4          (n_points)
  uint8  horizon (deg + 8) * 10, azimuths 0, 2, ..., 358 clockwise from local north   (n_points * n_az)
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
from lunanav.horizon import compute_horizon  # noqa: E402
from lunanav.polar_grid import PolarGrid, polar_xy  # noqa: E402

R = 1737400.0
_grid = None


def _init():
    global _grid
    _grid = PolarGrid.load()


def _latlon(x, y):
    r = np.hypot(x, y)
    return -90.0 + 2.0 * np.degrees(np.arctan(r / (2 * R))), np.degrees(np.arctan2(x, y))


def _one(args):
    x, y, n_az = args
    lat, lon = _latlon(x, y)
    hz = compute_horizon(_grid.sample_height, "atlas", float(lat), float(lon), n_azimuths=n_az, step_m=200.0)
    xs = np.array([x - 200, x + 200, x, x])
    ys = np.array([y, y, y - 200, y + 200])
    la, lo = _latlon(xs, ys)
    h = _grid.sample_height(la, lo)
    slope = np.degrees(np.arctan(np.hypot((h[1] - h[0]) / 400.0, (h[3] - h[2]) / 400.0)))
    h0 = _grid.sample_height(np.array([lat]), np.array([lon]))[0]
    return np.array(hz.elevations_deg, dtype=np.float32), float(h0), float(slope)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--spacing-km", type=float, default=2.0)
    ap.add_argument("--edge-lat", type=float, default=-84.5)
    ap.add_argument("--n-az", type=int, default=180)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    r_max = float(np.hypot(*polar_xy(args.edge_lat, 0.0)))
    c = np.arange(-r_max, r_max + 1, args.spacing_km * 1000.0)
    X, Y = np.meshgrid(c, c)
    inside = np.hypot(X, Y) <= r_max
    pts = [(float(x), float(y), args.n_az) for x, y in zip(X[inside], Y[inside])]
    print(f"{len(pts)} points, {args.n_az} azimuths, {args.workers} workers", flush=True)
    t0 = time.time()
    with Pool(args.workers, initializer=_init) as pool:
        res = pool.map(_one, pts, chunksize=64)
    print(f"traced in {time.time() - t0:.0f} s", flush=True)
    hz = np.vstack([r[0] for r in res])
    hz_u8 = np.clip(np.round((hz + 8.0) * 10.0), 0, 255).astype(np.uint8)
    xs = np.array([p[0] for p in pts]) / 1000.0
    ys = np.array([p[1] for p in pts]) / 1000.0
    out = ROOT / "web" / "public" / "data" / "atlas.bin"
    with open(out, "wb") as f:
        f.write(struct.pack("<IHff", len(pts), args.n_az, args.spacing_km * 1000.0, r_max))
        f.write(np.round(xs * 10).astype("<i2").tobytes())
        f.write(np.round(ys * 10).astype("<i2").tobytes())
        f.write(np.round([r[1] for r in res]).astype("<i2").tobytes())
        f.write(np.clip(np.round(np.array([r[2] for r in res]) * 4), 0, 255).astype("u1").tobytes())
        f.write(hz_u8.tobytes())
    clipped = int(((hz < -8) | (hz > 17.5)).sum())
    print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB); horizon range {hz.min():.1f}..{hz.max():.1f} deg, "
          f"{clipped} values clipped to -8..17.5 deg")


if __name__ == "__main__":
    main()
