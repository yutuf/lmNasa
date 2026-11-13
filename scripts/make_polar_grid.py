"""Build data/polar_grid.npz: the compact height map the app uses for horizons at any point.

  python scripts/make_polar_grid.py data/dem/ldem_85s_40m.img data/dem/ldem_80s_80m.img

Both inputs are PDS LOLA polar products (each with its .lbl next to it), from
https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/
The fine grid keeps every 5th pixel of the 40 m map (200 m), the coarse grid every 10th of the 80 m map (800 m).
Heights stay in the products' integer units (0.5 m).
"""
import argparse
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from make_relief import read_label  # noqa: E402


def decimate(img: Path, step: int):
    lab = read_label(img)
    dn = np.memmap(img, dtype="<i2", mode="r", shape=(lab["lines"], lab["samples"]))
    return (np.ascontiguousarray(dn[::step, ::step]), lab["m_per_px"] * step,
            lab["line0"] / step, lab["sample0"] / step, lab["dn_to_m"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fine_img", type=Path)
    ap.add_argument("coarse_img", type=Path)
    ap.add_argument("--fine-step", type=int, default=5)
    ap.add_argument("--coarse-step", type=int, default=10)
    args = ap.parse_args()
    f_dn, f_m, f_l, f_s, scale = decimate(args.fine_img, args.fine_step)
    c_dn, c_m, c_l, c_s, scale_c = decimate(args.coarse_img, args.coarse_step)
    assert scale == scale_c
    out = ROOT / "data" / "polar_grid.npz"
    np.savez_compressed(out, fine_dn=f_dn, fine_m_per_px=f_m, fine_line0=f_l, fine_sample0=f_s,
                        coarse_dn=c_dn, coarse_m_per_px=c_m, coarse_line0=c_l, coarse_sample0=c_s, scale=scale,
                        source=f"{args.fine_img.name} every {args.fine_step}; {args.coarse_img.name} every {args.coarse_step}")
    print(f"fine {f_dn.shape} at {f_m:.0f} m, coarse {c_dn.shape} at {c_m:.0f} m -> {out} "
          f"({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
