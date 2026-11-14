"""Hourly Sun and Earth for the in-browser search engine, and DSN visibility, over a long window (default to 2045).

  python scripts/build_ephem_web.py                    # 2026-11-01 .. 2045-12-31, checks, then writes
  python scripts/build_ephem_web.py --end 2030-12-31   # a shorter window
  python scripts/build_ephem_web.py --dry-run          # compute and compare only

Uses the kernels in data/kernels/: de440.bsp + moon_de440_250416.tf + pck00011.tpc + moon_pa_de440_200625.bpc when
present, otherwise de421.bsp + moon_080317.tf + pck00008.tpc + moon_pa_de421_1900-2050.bpc (DE421 is valid to 2050).
For every hour: the apparent Sun direction (unit vector) and the apparent Earth position (km) seen from the Moon's
centre, in the Moon mean-Earth (ME) body-fixed frame, and the Sun's apparent radius; plus whether any NASA Deep
Space Network complex (Goldstone, Madrid, Canberra) sees the Moon above 10 degrees.

Before writing, the new numbers are compared with the existing web/public/data/ephem.bin and dsn.bin over the
hours they share; the script stops if the Sun or Earth disagree by more than --max-diff-deg as seen from the south
pole, so a frame or kernel mix-up cannot slip through. Writes ephem.bin, dsn.bin and updates n / ephemeris in
manifest.json (the layout is unchanged: 7 float32 blocks of n values; uint8 per hour).
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from skyfield.api import Loader, wgs84
from skyfield.planetarylib import PlanetaryConstants

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lunanav.derive import sun_radius_deg  # noqa: E402

KERNELS = ROOT / "data" / "kernels"
WEB = ROOT / "web" / "public" / "data"
SETS = [  # (spk, frames tf, text pck, binary pck, ME frame name)
    ("de440.bsp", "moon_de440_250416.tf", "pck00011.tpc", "moon_pa_de440_200625.bpc", "MOON_ME_DE440_ME421"),
    ("de421.bsp", "moon_080317.tf", "pck00008.tpc", "moon_pa_de421_1900-2050.bpc", "MOON_ME_DE421"),
]
STATIONS = {"Goldstone": (35.426, -116.890, 1001.0), "Madrid": (40.431, -4.248, 865.0), "Canberra": (-35.402, 148.981, 689.0)}
R_MOON_KM = 1737.4


def kernels():
    for s in SETS:
        if all((KERNELS / f).exists() for f in s[:4]):
            return s
    raise SystemExit(f"no complete kernel set in {KERNELS}; run scripts/fetch_kernels.py")


def frame_for(pc, name):
    """The ME frame, built from the binary-PCK segment covering the present (see lunanav/ephemeris.py)."""
    integer = pc.variables[f"FRAME_{name}"]
    relative = pc.variables.get(f"TKFRAME_{integer}_RELATIVE")
    base = pc.variables[f"FRAME_{relative}"] if relative else integer
    segs = [g for g in pc._segment_list if g.body == base and g.initial_second <= 0.0 <= g.final_second]
    return pc.build_frame(integer, _segment=segs[0]) if segs else pc.build_frame_named(name)


def compute(unix, chunk=20000):
    spk, tf, tpc, bpc, me = kernels()
    load = Loader(str(KERNELS), verbose=False)
    eph = load(spk)
    ts = load.timescale()
    pc = PlanetaryConstants()
    pc.read_text(load(tf)); pc.read_text(load(tpc)); pc.read_binary(load(bpc))
    frame = frame_for(pc, me)
    moon, sun, earth = eph["moon"], eph["sun"], eph["earth"]
    sun_xyz = np.empty((len(unix), 3)); earth_xyz = np.empty((len(unix), 3)); dsn = np.zeros(len(unix), bool)
    stations = [earth + wgs84.latlon(la, lo, elevation_m=h) for la, lo, h in STATIONS.values()]
    for a in range(0, len(unix), chunk):
        b = min(len(unix), a + chunk)
        t = ts.utc(1970, 1, 1, 0, 0, unix[a:b].astype(float))
        m = moon.at(t)
        s = m.observe(sun).apparent().frame_xyz(frame).km.T
        sun_xyz[a:b] = s / np.linalg.norm(s, axis=1)[:, None]
        earth_xyz[a:b] = m.observe(earth).apparent().frame_xyz(frame).km.T
        for st in stations:
            alt, _, _ = st.at(t).observe(moon).apparent().altaz()
            dsn[a:b] |= alt.degrees > 10
        print(f"  {b}/{len(unix)} hours", flush=True)
    return spk, sun_xyz, earth_xyz, dsn


def angle_deg(u, v):
    u = u / np.linalg.norm(u, axis=1)[:, None]; v = v / np.linalg.norm(v, axis=1)[:, None]
    return np.degrees(np.arccos(np.clip((u * v).sum(axis=1), -1, 1)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--end", default="2045-12-31")
    ap.add_argument("--max-diff-deg", type=float, default=0.02)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    man_path = WEB / "manifest.json"
    man = json.loads(man_path.read_text(encoding="utf-8"))
    start = int(man["start_unix"])
    end = int(np.datetime64(args.end + "T23:00:00", "s").astype(np.int64))
    unix = np.arange(start, end + 1, 3600, dtype=np.int64)
    print(f"{len(unix)} hours, {np.datetime64(start, 's')} .. {np.datetime64(int(unix[-1]), 's')}")
    spk, sun_xyz, earth_xyz, dsn = compute(unix)

    # compare with the existing files over the shared hours
    n0 = int(man["n"])
    old = np.frombuffer((WEB / "ephem.bin").read_bytes(), "<f4").reshape(7, n0)
    k = min(n0, len(unix))
    pole = np.array([0.0, 0.0, -R_MOON_KM])                              # a lander at the south pole
    d_sun = angle_deg(sun_xyz[:k], old[0:3, :k].T)
    d_earth = angle_deg(earth_xyz[:k] - pole, old[3:6, :k].T - pole)
    old_dsn = np.frombuffer((WEB / "dsn.bin").read_bytes(), "u1")[:k].astype(bool)
    agree = np.mean(old_dsn == dsn[:k])
    print(f"vs existing data over {k} shared hours ({spk}): Sun median {np.median(d_sun):.4f} deg, max {d_sun.max():.4f}; "
          f"Earth (seen from the pole) median {np.median(d_earth):.4f} deg, max {d_earth.max():.4f}; DSN hours agree {agree:.2%}")
    if max(d_sun.max(), d_earth.max()) > args.max_diff_deg:
        raise SystemExit(f"STOP: disagreement above {args.max_diff_deg} deg; nothing written")
    print(f"DSN: some complex sees the Moon above 10 deg {dsn.mean():.1%} of the hours")
    if args.dry_run:
        return
    blocks = [sun_xyz[:, 0], sun_xyz[:, 1], sun_xyz[:, 2], earth_xyz[:, 0], earth_xyz[:, 1], earth_xyz[:, 2],
              sun_radius_deg(unix.astype("datetime64[s]"))]
    (WEB / "ephem.bin").write_bytes(b"".join(np.asarray(a, "<f4").tobytes() for a in blocks))
    (WEB / "dsn.bin").write_bytes(dsn.astype("u1").tobytes())
    man["n"] = int(len(unix))
    man["ephemeris"] = {"spk": spk, "end_utc": str(np.datetime64(int(unix[-1]), "s")),
                        "check": {"shared_hours": k, "sun_max_deg": round(float(d_sun.max()), 5),
                                  "earth_max_deg": round(float(d_earth.max()), 5), "dsn_agree": round(float(agree), 5)}}
    man_path.write_text(json.dumps(man, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote ephem.bin ({(WEB / 'ephem.bin').stat().st_size / 1e6:.1f} MB), dsn.bin, manifest n={len(unix)}")


if __name__ == "__main__":
    main()
