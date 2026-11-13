"""Small terrain patches around the simple view's polar spots, for its 3D view (data/terrain/<site>.npz).

Cuts a square from a PDS LOLA polar DEM (the same product as scripts/make_relief.py), centred on the site,
and stores heights in metres on a regular grid in the south-polar stereographic plane: +x toward 90 deg E,
+y toward longitude 0 (the Earth-facing side), x/y in km relative to the site.

  python scripts/make_terrain_patches.py data/dem/ldem_85s_40m.img
"""
import argparse
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from make_relief import read_label, south_polar_xy  # noqa: E402

from lunanav.sites import load_sites  # noqa: E402

SITES = ["malapert_massif", "malapert_massif_derived", "malapert_massif_region_best", "shackleton_ridge"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dem", type=Path)
    ap.add_argument("--size-km", type=float, default=40.0)
    ap.add_argument("--step", type=int, default=4, help="use every Nth DEM pixel (4 x 40 m = 160 m)")
    args = ap.parse_args()

    lab = read_label(args.dem)
    dem = np.memmap(args.dem, dtype="<i2", mode="r", shape=(lab["lines"], lab["samples"]))
    known = {s.id: s for s in load_sites()}
    out = ROOT / "data" / "terrain"
    out.mkdir(parents=True, exist_ok=True)
    half = int(round(args.size_km * 500 / lab["m_per_px"]))
    for sid in SITES:
        s = known[sid]
        x, y = south_polar_xy(s.lat, s.lon)
        col = int(round(lab["sample0"] + x / lab["m_per_px"]))
        row = int(round(lab["line0"] - y / lab["m_per_px"]))
        z = np.asarray(dem[row - half:row + half + 1:args.step, col - half:col + half + 1:args.step], dtype=np.float32)
        z *= lab["dn_to_m"]
        n = z.shape[0]
        km = (np.arange(n) - (n - 1) / 2) * lab["m_per_px"] * args.step / 1000.0
        np.savez_compressed(out / f"{sid}.npz", heights_m=z.astype(np.int16), x_km=km.astype(np.float32),
                            y_km=km[::-1].astype(np.float32), spacing_m=lab["m_per_px"] * args.step,
                            source=args.dem.name, site=sid)
        print(f"{sid}: {n} x {n}, {z.min():.0f} .. {z.max():.0f} m, site at {z[n // 2, n // 2]:.0f} m")


if __name__ == "__main__":
    main()
