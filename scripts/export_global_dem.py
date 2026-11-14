"""A light whole-Moon height map for the web's 3D site renders outside the south pole.

  python scripts/export_global_dem.py          # LDEM_16 (data/global_grid.npz) averaged 2x2 -> 8 px/deg, about 3.8 km

Written to web/public/data/global_dem.bin (little-endian), loaded only when the whole-Moon scope is used:
  uint16 px_per_deg, uint16 rows, uint16 cols, float32 metres_per_unit
  int16  heights, rows from 90 N down, columns from 0 E eastward (simple cylindrical, like LDEM)
"""
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def main():
    z = np.load(ROOT / "data" / "global_grid.npz")
    dn = z["dn"].astype(np.float32) * float(z["scale"])        # metres
    ppd = float(z["ppd"])
    k = 2
    h = dn[: dn.shape[0] // k * k, : dn.shape[1] // k * k].reshape(dn.shape[0] // k, k, dn.shape[1] // k, k).mean(axis=(1, 3))
    out = ROOT / "web" / "public" / "data" / "global_dem.bin"
    unit = 1.0                                                  # whole metres fit int16 (heights are within about +-11 km)
    with open(out, "wb") as f:
        f.write(struct.pack("<HHHf", int(ppd / k), h.shape[0], h.shape[1], unit))
        f.write(np.clip(np.round(h / unit), -32768, 32767).astype("<i2").tobytes())
    print(f"{h.shape[0]}x{h.shape[1]} at {ppd / k:.0f} px/deg (~{1737.4 * np.pi / 180 / (ppd / k):.1f} km); "
          f"heights {h.min():.0f}..{h.max():.0f} m; wrote {out} ({out.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
