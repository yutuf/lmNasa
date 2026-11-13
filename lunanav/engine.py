"""Reference implementation of the web search engine (web/src/engine.ts), for parity tests.

Reads the same files the browser reads (web/public/data/atlas.bin, ephem.bin, dsn.bin) and computes, for one atlas
point, the hourly sun fraction and Earth visibility with the same formulas, then the mission windows with
lunanav.metrics. scripts/export_engine_expected.py writes its results for web/src/engine.test.ts.
"""
from __future__ import annotations

import struct
from pathlib import Path

import numpy as np

from .geometry import disk_visible_fraction
from .metrics import MissionConstraints, evaluate_window

R_KM = 1737.4
WEB_DATA = Path(__file__).resolve().parent.parent / "web" / "public" / "data"


def load_atlas(path: Path = WEB_DATA / "atlas.bin"):
    b = path.read_bytes()
    n, n_az, spacing, r_max = struct.unpack_from("<IHff", b, 0)
    o = 14
    x = np.frombuffer(b, "<i2", n, o) / 10.0
    o += 2 * n
    y = np.frombuffer(b, "<i2", n, o) / 10.0
    o += 2 * n
    height = np.frombuffer(b, "<i2", n, o)
    o += 2 * n
    slope = np.frombuffer(b, "u1", n, o) / 4.0
    o += n
    hz = np.frombuffer(b, "u1", n * n_az, o).reshape(n, n_az) / 10.0 - 8.0
    return dict(n=n, n_az=n_az, spacing=spacing, r_max=r_max, x=x, y=y, height=height, slope=slope, horizon=hz)


def load_ephem(n: int, path: Path = WEB_DATA / "ephem.bin"):
    a = np.frombuffer(path.read_bytes(), "<f4").reshape(7, n).astype(np.float64)
    return a[0:3].T, a[3:6].T, a[6]


def point_latlon(x_km, y_km):
    r = np.hypot(x_km, y_km) * 1000.0
    return -90.0 + 2.0 * np.degrees(np.arctan(r / (2 * 1737400.0))), np.degrees(np.arctan2(x_km, y_km))


def point_sky(atlas, sun, earth, sun_r, dsn, index, first_hour, hours, need_dsn=False):
    lat, lon = point_latlon(atlas["x"][index], atlas["y"][index])
    la, lo = np.radians(lat), np.radians(lon)
    e = np.array([-np.sin(lo), np.cos(lo), 0.0])
    n = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    u = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    sl = slice(first_hour, first_hour + hours)
    az_bins = np.arange(atlas["n_az"]) * 360.0 / atlas["n_az"]
    hz = atlas["horizon"][index]
    s = sun[sl]
    s_alt = np.degrees(np.arcsin(np.clip(s @ u, -1, 1)))
    s_az = np.degrees(np.arctan2(s @ e, s @ n))
    frac = disk_visible_fraction(s_alt, np.interp(s_az % 360.0, az_bins, hz, period=360.0), sun_r[sl])
    d = earth[sl] - R_KM * u
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    e_alt = np.degrees(np.arcsin(np.clip(d @ u, -1, 1)))
    e_az = np.degrees(np.arctan2(d @ e, d @ n))
    vis = e_alt > np.interp(e_az % 360.0, az_bins, hz, period=360.0)
    if need_dsn:
        vis &= np.asarray(dsn[sl], bool)
    return float(lat), float(lon), frac, vis


def search_point(atlas, sun, earth, sun_r, dsn, index, first_hour, n_starts, stride_h, duration_h,
                 c: MissionConstraints, need_dsn=False):
    hours = (n_starts - 1) * stride_h + duration_h
    lat, lon, frac, vis = point_sky(atlas, sun, earth, sun_r, dsn, index, first_hour, hours, need_dsn)
    go_count, best = 0, None
    for s in range(n_starts):
        a = s * stride_h
        w = evaluate_window(frac[a:a + duration_h], frac[a:a + duration_h], vis[a:a + duration_h], 1.0, c)
        go_count += w.meets_constraints
        if best is None or w.score > best[0]:
            best = (w.score, s, w.meets_constraints, w.sun_frac, w.comm_frac, w.longest_dark_h)
    return dict(index=int(index), lat=lat, lon=lon, goCount=int(go_count), bestScore=best[0], bestStart=best[1],
                bestGo=bool(best[2]), sunFrac=best[3], commFrac=best[4], longestDarkH=best[5])
