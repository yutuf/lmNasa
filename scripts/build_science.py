"""Science value for every search point: how close is water ice, and how much of it is within reach?

  python scripts/build_science.py           # after export_psr.py and export_thermal.py; a few seconds

An "ice cold trap" here is a 240 m cell that is permanently shadowed (Mazarico et al. 2011, PSR share >= 0.5) and
where LRO Diviner says water ice is stable within 1 m of the surface (Paige et al., ice stability depth <= 100 cm):
ground a rover or a drill could actually reach. For every point of the search grid (the same order as atlas.bin):
the distance to the nearest such cell, and the area of them within 5 km (a rover's day trip).

Written to web/public/data/science.bin (little-endian):
  uint32 n_points
  uint8  distance_km * 4    (n_points; 255 = more than 63 km or outside the data)
  uint16 cold_trap_km2 * 100 within 5 km   (n_points)
"""
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_hazard import atlas_points  # noqa: E402

DATA = ROOT / "web" / "public" / "data"
REACH_M = 5000.0


def grid(path, n_layers):
    b = path.read_bytes()
    n = struct.unpack_from("<I", b)[0]
    m, half = struct.unpack_from("<ff", b, 4)
    layers = np.frombuffer(b, np.uint8, n * n * n_layers, 12).reshape(n_layers, n, n)
    return n, float(m), float(half), layers


def main():
    n, m, half, psr = grid(DATA / "psr.bin", 4)
    n2, m2, half2, th = grid(DATA / "thermal.bin", 3)
    assert (n, m, half) == (n2, m2, half2), "psr.bin and thermal.bin must share a grid"
    shadow = psr[0] / 255.0
    depth_cm = th[2].astype(float)                     # 255 = no stable ice within reach
    trap = (shadow >= 0.5) & (depth_cm <= 100)
    print(f"grid {n}x{n} at {m:.0f} m (+-{half / 1000:.0f} km); ice cold traps: {trap.sum()} cells = {trap.sum() * m * m / 1e6:.0f} km2")

    dist_px = distance_transform_edt(~trap)
    xs, ys = atlas_points()
    col = np.floor((xs + half) / m).astype(int)
    row = np.floor((half - ys) / m).astype(int)
    inside = (col >= 0) & (row >= 0) & (col < n) & (row < n)
    dist_km = np.full(len(xs), np.inf)
    dist_km[inside] = dist_px[row[inside], col[inside]] * m / 1000.0

    # cold-trap area within 5 km: sum over a disc, via a cumulative sum box then an exact disc mask per point
    r = int(np.ceil(REACH_M / m))
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    disc = (xx ** 2 + yy ** 2) * m * m <= REACH_M ** 2
    pad = np.pad(trap, r)
    area = np.zeros(len(xs))
    for i in np.flatnonzero(inside):
        win = pad[row[i]:row[i] + 2 * r + 1, col[i]:col[i] + 2 * r + 1]
        area[i] = (win & disc).sum() * m * m / 1e6

    out = DATA / "science.bin"
    with open(out, "wb") as f:
        f.write(struct.pack("<I", len(xs)))
        f.write(np.where(np.isfinite(dist_km), np.clip(np.round(dist_km * 4), 0, 254), 255).astype("u1").tobytes())
        f.write(np.clip(np.round(area * 100), 0, 65535).astype("<u2").tobytes())
    ok = np.isfinite(dist_km)
    print(f"{ok.sum()} of {len(xs)} points inside the data; median distance to ice {np.median(dist_km[ok]):.1f} km; "
          f"within 2 km: {(dist_km[ok] <= 2).mean():.0%}; median cold-trap area within 5 km {np.median(area[ok]):.2f} km2")
    print(f"wrote {out} ({out.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
