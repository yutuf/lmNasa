"""Hourly Earth-Moon centre distance for the data window (data/earth_distance.npz).

Sun and Earth directions for a new point on the Moon are obtained by rotating a computed site's series
(lunanav.anywhere). The Sun is so far away that its direction is the same from every point on the Moon, but
Earth is close enough for parallax to matter (up to about 0.26 deg across the Moon), so the rotation needs
the Earth-Moon distance at every hour.

  python scripts/precompute_earth_distance.py        # data/kernels/de440.bsp, or de421.bsp
"""
from pathlib import Path

import numpy as np
from skyfield.api import Loader

ROOT = Path(__file__).resolve().parents[1]
KERNELS = ROOT / "data" / "kernels"
TIMES_FROM = ROOT / "data" / "series" / "apollo_11.npz"


def main():
    load = Loader(str(KERNELS), verbose=False)
    spk = next((n for n in ("de440.bsp", "de421.bsp") if (KERNELS / n).exists()), None)
    if spk is None:
        raise SystemExit(f"no planetary ephemeris in {KERNELS}; run scripts/fetch_kernels.py")
    eph = load(spk)
    ts = load.timescale()
    unix = np.load(TIMES_FROM)["times"].astype(np.int64)
    t = ts.utc(1970, 1, 1, 0, 0, unix.astype(float))
    km = (eph["earth"] - eph["moon"]).at(t).distance().km
    out = ROOT / "data" / "earth_distance.npz"
    np.savez_compressed(out, times=unix, earth_moon_km=km.astype(np.float32), ephemeris=spk)
    print(f"{len(unix)} hours, {km.min():,.0f} .. {km.max():,.0f} km -> {out}")


if __name__ == "__main__":
    main()
