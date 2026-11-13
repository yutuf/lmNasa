"""Hourly Moon elevation above the horizon at NASA's three Deep Space Network complexes.

A lander can only talk to Earth directly when Earth is above its lunar horizon AND one of the DSN's big
dishes on Earth can point at the Moon. This script computes the second half: for every hour of the data
window (the same times as data/series/), the Moon's apparent elevation seen from Goldstone, Madrid and
Canberra. It writes data/dsn.npz, which the app reads; the app never needs the kernels.

  python scripts/precompute_dsn.py                # uses data/kernels/de440.bsp, or de421.bsp if that is all there is

Station coordinates (geodetic, rounded to 0.001 deg) are those of each complex's 70 m antenna as published by
NASA/JPL in the DSN Telecommunications Link Design Handbook (810-005, module 301). The Moon's centre is used;
seen from Earth the lander can be up to 0.26 deg away from it, which does not matter against an elevation mask
of several degrees.
"""
from pathlib import Path

import numpy as np
from skyfield.api import Loader, wgs84

ROOT = Path(__file__).resolve().parents[1]
KERNELS = ROOT / "data" / "kernels"
OUT = ROOT / "data" / "dsn.npz"
TIMES_FROM = ROOT / "data" / "series" / "apollo_11.npz"   # every series shares the same hourly times

STATIONS = {  # name: (lat deg, lon deg east, height m)
    "Goldstone": (35.426, -116.890, 1001.0),
    "Madrid": (40.431, -4.248, 865.0),
    "Canberra": (-35.402, 148.981, 689.0),
}


def main():
    load = Loader(str(KERNELS), verbose=False)
    spk = next((n for n in ("de440.bsp", "de421.bsp") if (KERNELS / n).exists()), None)
    if spk is None:
        raise SystemExit(f"no planetary ephemeris in {KERNELS}; run scripts/fetch_kernels.py")
    eph = load(spk)
    ts = load.timescale()
    unix = np.load(TIMES_FROM)["times"].astype(np.int64)
    t = ts.utc(1970, 1, 1, 0, 0, unix.astype(float))
    elev = []
    for name, (lat, lon, h) in STATIONS.items():
        site = eph["earth"] + wgs84.latlon(lat, lon, elevation_m=h)
        alt, _, _ = site.at(t).observe(eph["moon"]).apparent().altaz()
        elev.append(alt.degrees.astype("float32"))
        print(f"{name}: Moon above 10 deg {np.mean(alt.degrees > 10):.1%} of the hours")
    elev = np.vstack(elev)
    print(f"any complex above 10 deg: {np.mean((elev > 10).any(axis=0)):.1%} of {len(unix)} hours")
    np.savez_compressed(OUT, times=unix, stations=np.array(list(STATIONS)), moon_elevation_deg=elev,
                        station_coords=np.array(list(STATIONS.values()), dtype="float64"), ephemeris=spk)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
