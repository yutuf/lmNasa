"""Export everything the static web app (web/) needs into web/public/data/.

  python scripts/export_web_data.py --ldem64 data/dem/ldem_64.img

Writes:
  manifest.json            spots (names EN/TR, lat/lon, group, horizon profile, file names), time axis, sources
  series/<id>.bin          per hour: float32 sun_fraction, int16 sun_alt*100, int16 sun_az*50,
                           int16 earth_alt*100, int16 earth_az*50, uint8 earth_visible (in that order)
  dsn.bin                  per hour: uint8, 1 when a DSN complex sees the Moon above 10 deg
  pole_dem.bin             uint32 rows, cols; float32 m_per_px, line0, sample0, scale; int16 heights (south polar
                           stereographic, 200 m): terrain for the rover and lander views
  ephem.bin                per hour, float32 blocks: Sun unit vector x,y,z and Earth position x,y,z (km) in the
                           Moon-fixed frame, then the Sun's apparent radius (deg): the search engine's input
  terrain/<id>.bin         int16 heights (m) of the 3D patch around the spot (see manifest for size and frame)
  moon_albedo.jpg, moon_normal.jpg, pole_albedo.jpg, pole_normal.jpg textures for the 3D Moon, from LOLA LDEM_16
  expected.json            the Python models' results on the exported data (the web tests must match them)

South-pole spots reuse the committed series and horizons. Landed missions get a horizon traced from LOLA
LDEM_64 (474 m) and Sun/Earth tracks rotated from Apollo 11's series with Earth parallax (lunanav/anywhere.py).
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lunanav.anywhere import GlobalGrid, load_earth_distance, rotate_earth, rotate_sun  # noqa: E402
from lunanav.derive import sun_radius_deg  # noqa: E402
from lunanav.dsn import DSN  # noqa: E402
from lunanav.geometry import disk_visible_fraction  # noqa: E402
from lunanav.horizon import compute_horizon, load_profiles  # noqa: E402
from lunanav.metrics import MissionConstraints, evaluate_window  # noqa: E402
from lunanav.power import required_battery_wh, simulate_battery  # noqa: E402
from lunanav.series import load_series  # noqa: E402
from lunanav.sites import load_sites  # noqa: E402
from lunanav.terrain3d import load_patch  # noqa: E402

OUT = ROOT / "web" / "public" / "data"

POLE = [  # id, name EN, name TR, description EN, description TR
    ("malapert_massif", "Malapert: published spot", "Malapert: yayınlanan nokta",
     "Malapert Massif, the point NASA lists for this Artemis III region (86°S).",
     "Malapert Dağı, NASA'nın bu Artemis III bölgesi için verdiği nokta (86°G)."),
    ("malapert_massif_derived", "Malapert: 447 m away", "Malapert: 447 m ötede",
     "Less than half a kilometre from the published spot, on the same mountain.",
     "Yayınlanan noktadan yarım kilometreden az uzakta, aynı dağın üzerinde."),
    ("malapert_massif_region_best", "Malapert: 5 km away", "Malapert: 5 km ötede",
     "The best spot LunaNav found inside the same Artemis III region, 5 km west.",
     "LunaNav'ın aynı Artemis III bölgesinde bulduğu en iyi nokta, 5 km batıda."),
    ("shackleton_ridge", "Shackleton ridge", "Shackleton sırtı",
     "A ridge 60 km from the pole, one of the best-lit places on the Moon.",
     "Kutba 60 km uzaklıkta bir sırt; Ay'ın en çok ışık alan yerlerinden biri."),
]


class Ldem64:
    """Bilinear sampler on the LOLA 64 px/deg global grid (memory-mapped)."""

    def __init__(self, img: Path):
        lab = img.with_suffix(".lbl").read_text(errors="replace")
        num = lambda k: float(re.search(rf"^\s*{k}\s*=\s*([-0-9.eE+]+)", lab, re.M).group(1))  # noqa: E731
        self.ppd, self.scale = num("MAP_RESOLUTION"), num("SCALING_FACTOR")
        self.dn = np.memmap(img, dtype="<i2", mode="r", shape=(int(num("LINES")), int(num("LINE_SAMPLES"))))
        self.source = img.name

    def sample_height(self, lat, lon):
        lat = np.atleast_1d(np.asarray(lat, float))
        lon = np.atleast_1d(np.asarray(lon, float)) % 360.0
        col, row = self.ppd * lon - 0.5, self.ppd * (90.0 - lat) - 0.5
        n_r, n_c = self.dn.shape
        c0, r0 = np.floor(col).astype(int), np.clip(np.floor(row).astype(int), 0, n_r - 2)
        fc, fr = col - np.floor(col), np.clip(row - r0, 0.0, 1.0)
        c0, c1 = c0 % n_c, (c0 + 1) % n_c
        h = lambda r, c: self.dn[r, c].astype(np.float64) * self.scale  # noqa: E731
        return (h(r0, c0) * (1 - fc) * (1 - fr) + h(r0, c1) * fc * (1 - fr)
                + h(r0 + 1, c0) * (1 - fc) * fr + h(r0 + 1, c1) * fc * fr)


def write_series(path: Path, v):
    path.parent.mkdir(parents=True, exist_ok=True)
    parts = [np.asarray(v.sun_fraction, "<f4"),
             np.round(np.asarray(v.sun_alt) * 100).astype("<i2"), np.round(np.asarray(v.sun_az) % 360 * 50).astype("<i2"),
             np.round(np.asarray(v.earth_alt) * 100).astype("<i2"), np.round(np.asarray(v.earth_az) % 360 * 50).astype("<i2"),
             np.asarray(v.earth_visible, "u1")]
    path.write_bytes(b"".join(p.tobytes() for p in parts))


def read_series(path: Path, n: int):
    b = path.read_bytes()
    o = 0
    sf = np.frombuffer(b, "<f4", n, o)
    o += 4 * n
    ints = [np.frombuffer(b, "<i2", n, o + 2 * n * k).astype(float) for k in range(4)]
    o += 8 * n
    ev = np.frombuffer(b, "u1", n, o).astype(bool)
    return dict(sun_fraction=sf.astype(float), sun_alt=ints[0] / 100, sun_az=ints[1] / 50,
                earth_alt=ints[2] / 100, earth_az=ints[3] / 50, earth_visible=ev)


def _normal_rgb(h, east_m, north_m, k):
    """Tangent-space normal map (x east, y north, z up) from heights on a grid with the given pixel sizes."""
    gy, gx = np.gradient(h)
    n = np.dstack([-gx / east_m * k, gy / north_m * k, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def textures(grid: GlobalGrid, polar):
    """Global albedo + normal map (equirectangular, 2048 x 1024, centre 0 E) and a south-polar cap (stereographic,
    2048 x 2048, out to 80 S) from the 200 m / 800 m polar grid, which is far sharper near the pole."""
    img = Image.fromarray(grid.h.astype(np.float32), "F").resize((2048, 1024), Image.BOX)
    h = np.roll(np.asarray(img, dtype=np.float64), 1024, axis=1)          # column 0 = 180 W
    lo, hi = np.percentile(h, [2, 98])
    alb = np.clip(0.42 + 0.45 * (h - lo) / (hi - lo), 0, 1)
    Image.fromarray((alb * 255).astype(np.uint8), "L").convert("RGB").save(OUT / "moon_albedo.jpg", quality=88)
    lat = 90 - (np.arange(1024) + 0.5) * 180 / 1024
    px = 2 * np.pi * 1737400 / 2048
    east = (px * np.maximum(np.cos(np.radians(lat)), 0.02))[:, None]
    nrgb = _normal_rgb(h, east, px, 6.0).astype(np.float64)
    fade = np.clip(np.cos(np.radians(lat)) / np.cos(np.radians(72)), 0, 1)[:, None, None]   # the poles get the cap
    nrgb = fade * nrgb + (1 - fade) * np.array([127.5, 127.5, 255.0])
    Image.fromarray(nrgb.astype(np.uint8), "RGB").save(OUT / "moon_normal.jpg", quality=92)

    # south-polar cap: stereographic, +x toward 90 E, +y toward 0 E, radius out to 80 S
    from lunanav.polar_grid import polar_xy
    r_max = float(np.hypot(*polar_xy(-80.0, 0.0)))
    size = 2048
    c = (np.arange(size) + 0.5) / size * 2 * r_max - r_max
    X, Y = np.meshgrid(c, c[::-1])                                           # image row 0 = +y (toward 0 E)
    hp = polar.sample_height(-90 + 2 * np.degrees(np.arctan(np.hypot(X, Y) / (2 * 1737400.0))),
                             np.degrees(np.arctan2(X, Y))).reshape(X.shape)
    hp = np.where(np.isfinite(hp), hp, np.nanmean(hp))
    alb_p = np.clip(0.42 + 0.45 * (hp - lo) / (hi - lo), 0, 1)
    # a soft relief shade bakes in the terrain at full resolution (the normal map adds the live Sun on top)
    Image.fromarray((alb_p * 255).astype(np.uint8), "L").convert("RGB").save(OUT / "pole_albedo.jpg", quality=90)
    step = 2 * r_max / size
    Image.fromarray(_normal_rgb(hp, step, step, 3.0), "RGB").save(OUT / "pole_normal.jpg", quality=92)
    return r_max


def mission_patch(sampler, lat, lon, size_km=60.0, spacing_m=400.0):
    n = int(size_km * 1000 / spacing_m) + 1
    km = (np.arange(n) - (n - 1) / 2) * spacing_m / 1000.0
    X, Y = np.meshgrid(km, km[::-1])
    dlat = np.degrees(Y / 1737.4)
    dlon = np.degrees(X / (1737.4 * max(np.cos(np.radians(lat)), 0.05)))
    z = sampler.sample_height((lat + dlat).ravel(), (lon + dlon).ravel()).reshape(X.shape)
    return z, spacing_m


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ldem64", type=Path, required=True)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    ldem = Ldem64(args.ldem64)
    sites = {s.id: s for s in load_sites()}
    hz_ref = load_profiles(ROOT / "data" / "horizons.json")
    times, km = load_earth_distance()
    v_ref, step, _ = load_series("apollo_11")
    a11 = sites["apollo_11"]
    n = len(times)
    spots = []

    def add(sid, name_en, name_tr, desc_en, desc_tr, group, lat, lon, v, horizon, patch, frame):
        write_series(OUT / "series" / f"{sid}.bin", v)
        entry = dict(id=sid, name={"en": name_en, "tr": name_tr}, desc={"en": desc_en, "tr": desc_tr}, group=group,
                     lat=round(lat, 5), lon=round(lon, 5), series=f"series/{sid}.bin",
                     horizon=[round(float(x), 3) for x in horizon.elevations_deg], patch=None)
        if patch is not None:
            z, spacing = patch
            (OUT / "terrain").mkdir(exist_ok=True)
            (OUT / "terrain" / f"{sid}.bin").write_bytes(np.round(z).astype("<i2").tobytes())
            entry["patch"] = dict(file=f"terrain/{sid}.bin", n=int(z.shape[0]), spacing_m=float(spacing), frame=frame)
        spots.append(entry)

    for sid, en, tr, den, dtr in POLE:
        v, _, _ = load_series(sid)
        p = load_patch(sid)
        add(sid, en, tr, den, dtr, "pole", sites[sid].lat, sites[sid].lon, v, hz_ref[sid],
            (p[0], p[3]) if p else None, "polar")
    for s in sites.values():                                         # the other Artemis III best points
        if s.id.endswith("_region_best") and s.id.startswith("artemis_"):
            v, _, _ = load_series(s.id)
            if v is None or s.id not in hz_ref:
                continue
            region = s.name.split(" — ")[0]
            add(s.id, f"{region}: best spot", f"{region}: en iyi nokta",
                f"The best spot LunaNav found inside the {region} Artemis III region.",
                f"LunaNav'ın {region} Artemis III bölgesinde bulduğu en iyi nokta.", "artemis", s.lat, s.lon, v,
                hz_ref[s.id], None, "polar")

    missions = yaml.safe_load((ROOT / "data" / "landed_missions.yaml").read_text(encoding="utf-8"))["missions"]
    from lunanav.visibility import Visibility
    for m in missions:
        lat, lon = float(m["lat"]), float(m["lon"])
        sid = "mission_" + re.sub(r"[^a-z0-9]+", "_", m["name"].lower()).strip("_")
        hz = compute_horizon(ldem.sample_height, sid, lat, lon, step_m=400.0, source=ldem.source)
        sun_alt, sun_az = rotate_sun(v_ref.sun_alt, v_ref.sun_az, a11.lat, a11.lon, lat, lon)
        earth_alt, earth_az = rotate_earth(v_ref.earth_alt, v_ref.earth_az, km, a11.lat, a11.lon, lat, lon)
        sun_h, earth_h = hz.at(sun_az), hz.at(earth_az)
        frac = disk_visible_fraction(sun_alt, sun_h, sun_radius_deg(v_ref.times_utc))
        v = Visibility(v_ref.times_utc, sun_alt, sun_az, sun_h, frac, earth_alt, earth_az, earth_h, earth_alt > earth_h)
        add(sid, m["name"], m["name"], f"{m['name']}: landing site.", f"{m['name']}: iniş yeri.", "mission",
            lat, lon, v, hz, mission_patch(ldem, lat, lon), "enu")
        print(f"{sid}: sun {np.mean(frac >= 0.5):.0%}, earth {np.mean(v.earth_visible):.0%}")

    # ephemeris for the in-browser search engine: Sun unit vector and Earth position (km) in the Moon-fixed
    # frame, and the Sun's apparent radius, hourly; built from Apollo 11's DE440 series (lunanav/anywhere.py)
    from lunanav.anywhere import R_MOON_KM, _direction, _enu
    d_sun = _direction(v_ref.sun_alt, v_ref.sun_az, a11.lat, a11.lon)
    d_earth = _direction(v_ref.earth_alt, v_ref.earth_az, a11.lat, a11.lon)
    p0 = R_MOON_KM * _enu(a11.lat, a11.lon)[2]
    b = d_earth @ p0
    s_km = -b + np.sqrt(b * b - R_MOON_KM ** 2 + km ** 2)
    earth_xyz = p0 + s_km[:, None] * d_earth
    eph = [d_sun[:, 0], d_sun[:, 1], d_sun[:, 2], earth_xyz[:, 0], earth_xyz[:, 1], earth_xyz[:, 2],
           sun_radius_deg(v_ref.times_utc)]
    (OUT / "ephem.bin").write_bytes(b"".join(np.asarray(a, "<f4").tobytes() for a in eph))
    # South-pole terrain for the rover and lander views: the 200 m polar grid (85 S product), int16 in 0.5 m units
    from lunanav.polar_grid import GRID_FILE
    zg = np.load(GRID_FILE)
    fine = zg["fine_dn"]
    (OUT / "pole_dem.bin").write_bytes(np.array([fine.shape[0], fine.shape[1]], "<u4").tobytes()
                                      + np.array([float(zg["fine_m_per_px"]), float(zg["fine_line0"]),
                                                  float(zg["fine_sample0"]), float(zg["scale"])], "<f4").tobytes()
                                      + fine.astype("<i2").tobytes())
    dsn = DSN.load()
    (OUT / "dsn.bin").write_bytes((dsn.elevation_deg > 10).any(axis=0).astype("u1").tobytes())
    from lunanav.polar_grid import PolarGrid
    pole_r = textures(GlobalGrid.load(), PolarGrid.load())

    # parity fixture: Python models on the exported (rounded) data
    c = MissionConstraints()
    expected = []
    for sp in spots:
        d = read_series(OUT / sp["series"], n)
        for start in (0, 3000, 7392, 12000, 18000):                  # 7392 h = 2027-09-09 00:00
            sl = slice(start, start + int(c.duration_days * 24 / step))
            p = simulate_battery(d["sun_fraction"][sl], d["sun_alt"][sl], step, c.power)
            r = evaluate_window(d["sun_fraction"][sl], d["sun_alt"][sl], d["earth_visible"][sl], step, c, p)
            expected.append(dict(spot=sp["id"], start=start, go=r.meets_constraints, sun_frac=r.sun_frac,
                                 comm_frac=r.comm_frac, longest_dark_h=r.longest_dark_h, min_soc=round(r.min_soc, 6),
                                 first_failure=p.first_failure_index, score=r.score,
                                 need_wh=round(required_battery_wh(d["sun_fraction"][sl], step, c.power), 3)))
    (OUT / "expected.json").write_text(json.dumps(expected, indent=0), encoding="utf-8")

    # Artemis III region outlines (USGS), as closed rings in the atlas's stereographic plane (km)
    from lunanav.outlines import chain
    from lunanav.polar_grid import polar_xy as stereo
    reg = json.loads((ROOT / "data" / "artemis_regions.json").read_text(encoding="utf-8"))["regions"]
    regions = []
    for name, r in reg.items():
        rings = []
        for ring in chain(r["lines"]):
            ring = np.asarray(ring, float)
            x, y = stereo(ring[:, 0], ring[:, 1])
            rings.append([[round(float(a) / 1000, 2), round(float(b) / 1000, 2)] for a, b in zip(x, y)][::2])
        regions.append(dict(name=name, rings=rings))
    manifest = dict(regions=regions, pole_cap=dict(albedo="pole_albedo.jpg", normal="pole_normal.jpg", r_max_m=pole_r, edge_lat=-80.0),
                    start_unix=int(times[0]), step_h=float(step), n=int(n), dsn="dsn.bin",
                    constraints=dict(duration_days=c.duration_days, min_sun_frac=c.min_sun_frac,
                                     min_comm_frac=c.min_comm_frac, max_dark_hours=c.max_dark_hours,
                                     array_peak_w=c.power.array_peak_w, load_w=c.power.load_w,
                                     battery_wh=c.power.battery_wh, initial_soc=c.power.initial_soc,
                                     charge_eff=c.power.charge_eff, discharge_eff=c.power.discharge_eff,
                                     min_soc=c.power.min_soc, weights=list(c.weights)),
                    spots=spots,
                    sources=["NASA LRO LOLA terrain (PDS)", "JPL DE440 ephemeris via Skyfield, checked against JPL Horizons",
                             "NASA DSN station positions", "USGS Artemis III region grids"])
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    size = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"{len(spots)} spots, {len(expected)} parity cases, {size / 1e6:.1f} MB in {OUT}")


if __name__ == "__main__":
    main()
