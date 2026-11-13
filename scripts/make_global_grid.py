"""Build data/global_grid.npz from the LOLA global grid, for horizons anywhere on the Moon.

  python scripts/make_global_grid.py data/dem/ldem_16.img

Input: the PDS LOLA simple-cylindrical product (16 pixels per degree, ~1.9 km at the equator) with its .lbl,
from https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/
Heights stay in the product's integer units (0.5 m).
"""
import argparse
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("img", type=Path)
    args = ap.parse_args()
    label = args.img.with_suffix(".lbl").read_text(errors="replace")

    def num(key):
        return float(re.search(rf"^\s*{key}\s*=\s*([-0-9.eE+]+)", label, re.M).group(1))

    lines, samples, ppd, scale = int(num("LINES")), int(num("LINE_SAMPLES")), num("MAP_RESOLUTION"), num("SCALING_FACTOR")
    assert num("WESTERNMOST_LONGITUDE") == 0 and num("MAXIMUM_LATITUDE") == 90, "expects a 0-360 E, 90 N-first grid"
    dn = np.fromfile(args.img, dtype="<i2").reshape(lines, samples)
    out = ROOT / "data" / "global_grid.npz"
    np.savez_compressed(out, dn=dn, ppd=ppd, scale=scale, source=f"{args.img.name} ({ppd:.0f} px/deg)")
    print(f"{dn.shape} at {ppd:.0f} px/deg -> {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
