"""Touchdown hazard for every search point: how steep is the ground inside the landing zone?

  python scripts/build_hazard.py                       # ~22,000 points, well under a minute

The search's own slope (atlas.bin) is measured over a 400 m baseline at the point itself: fine for "is this a
plateau", blind to the 40-100 m scale a lander's legs care about. Here every point of the same 2 km grid as
scripts/build_horizon_atlas.py gets the LOLA slope at a 40 m baseline (LDEM_80S_40M, 80 S to the pole), and the
95th percentile of it inside circles of 100, 250, 500 and 1000 m radius around the point: a site passes a "landing
zone" requirement only if 95 % of the zone is gentler than the limit, so one steep crater wall cannot hide behind a
flat centre. The slope is checked against LOLA's own 40 m slope product (LDSM_85S_40M) where both exist.

Written to web/public/data/hazard.bin (little-endian):
  uint32 n_points, uint8 n_zones, uint16 radius_m[n_zones]
  uint8  p95_slope_deg * 4    (n_zones * n_points, zone-major)
"""
import argparse
import struct
import sys
import time
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from make_relief import read_label  # noqa: E402

sys.path.insert(0, str(ROOT))
from lunanav.polar_grid import polar_xy  # noqa: E402

RADII = (100, 250, 500, 1000)


def atlas_points(spacing_km=2.0, edge_lat=-84.5):
    """The same grid, in the same order, as scripts/build_horizon_atlas.py."""
    r_max = float(np.hypot(*polar_xy(edge_lat, 0.0)))
    c = np.arange(-r_max, r_max + 1, spacing_km * 1000.0)
    X, Y = np.meshgrid(c, c)
    inside = np.hypot(X, Y) <= r_max
    return X[inside], Y[inside]


def slope_deg(z, m):
    """Slope of each 2x2 cell of a height window (m), 'm' metres per pixel. Rows run toward -y."""
    dx = ((z[:-1, 1:] - z[:-1, :-1]) + (z[1:, 1:] - z[1:, :-1])) / (2 * m)
    dy = ((z[:-1, :-1] - z[1:, :-1]) + (z[:-1, 1:] - z[1:, 1:])) / (2 * m)
    return np.degrees(np.arctan(np.hypot(dx, dy)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dem", type=Path, default=ROOT / "data" / "dem" / "ldem_80s_40m.img")
    ap.add_argument("--check", type=Path, default=ROOT / "data" / "dem" / "ldsm_85s_40m.img")
    args = ap.parse_args()
    lab = read_label(args.dem)
    dn = np.memmap(args.dem, dtype="<i2", mode="r", shape=(lab["lines"], lab["samples"]))
    m = lab["m_per_px"]
    w = int(np.ceil(max(RADII) / m)) + 2
    xs, ys = atlas_points()
    n = len(xs)
    out = np.zeros((len(RADII), n), dtype=np.float32)
    centre = np.full(n, np.nan, dtype=np.float32)
    t0 = time.time()
    for i, (x, y) in enumerate(zip(xs, ys)):
        col = lab["sample0"] + x / m
        row = lab["line0"] - y / m
        c0, r0 = int(np.floor(col)), int(np.floor(row))
        z = dn[r0 - w:r0 + w + 1, c0 - w:c0 + w + 1].astype(np.float32) * lab["dn_to_m"]
        s = slope_deg(z, m)
        # cell (j, k) of s is centred half a pixel right of / below pixel (r0 - w + j, c0 - w + k)
        jj, kk = np.mgrid[0:s.shape[0], 0:s.shape[1]]
        d = np.hypot((c0 - w + kk + 0.5 - col) * m, (r0 - w + jj + 0.5 - row) * m)
        for zi, rad in enumerate(RADII):
            out[zi, i] = np.percentile(s[d <= rad], 95)
        centre[i] = s[np.unravel_index(np.argmin(d), d.shape)]
    print(f"{n} points in {time.time() - t0:.0f} s")

    if args.check.exists():   # against LOLA's own 40 m slope map, inside 85 S where it exists
        cl = read_label(args.check)
        sm = np.memmap(args.check, dtype="<i2", mode="r", shape=(cl["lines"], cl["samples"]))
        cols = np.round(cl["sample0"] + xs / cl["m_per_px"] - 0.5).astype(int)
        rows = np.round(cl["line0"] - ys / cl["m_per_px"] - 0.5).astype(int)
        ok = (cols >= 0) & (rows >= 0) & (cols < cl["samples"]) & (rows < cl["lines"])
        ok[ok] = sm[rows[ok], cols[ok]] != 0                  # DN 0: no LOLA track there (no slope computed)
        ref = sm[rows[ok], cols[ok]].astype(np.float32) * 0.0015 + 45.0
        diff = np.abs(centre[ok] - ref)
        print(f"vs LDSM_85S_40M at {ok.sum()} points: median |diff| {np.median(diff):.2f} deg, "
              f"90th pct {np.percentile(diff, 90):.2f} deg, correlation {np.corrcoef(centre[ok], ref)[0, 1]:.3f}")

    dst = ROOT / "web" / "public" / "data" / "hazard.bin"
    with open(dst, "wb") as f:
        f.write(struct.pack("<IB", n, len(RADII)))
        f.write(np.array(RADII, dtype="<u2").tobytes())
        f.write(np.clip(np.round(out * 4), 0, 255).astype("u1").tobytes())
    for zi, rad in enumerate(RADII):
        v = out[zi]
        print(f"  {rad:5d} m zone: p95 slope median {np.median(v):.1f} deg; under 10 deg at {(v <= 10).mean():.0%} of points")
    print(f"wrote {dst} ({dst.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
