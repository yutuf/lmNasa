"""Find the best point within ~1 km of a cited site ("derived" point).

Cited sites come from publications and stay exactly as published. A derived
point is OUR computation: the grid cell near a cited site where the lander would
see the Sun and Earth together most often, on a slope it can land on. The app
always labels it "derived" and shows it next to the cited point, never instead
of it.

Sky geometry trick: the Sun and Earth are so far away that moving 1 km on the
Moon changes their direction in space by < 0.0002 deg. What changes is the local
horizon frame (which way is "up" and "north"). So the alt/az series already
computed for the cited site is reprojected into each candidate's frame; no
ephemeris kernels are needed, only the DEM.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .geometry import destination, disk_visible_fraction
from .horizon import HorizonProfile


def _enu(lat_deg, lon_deg):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    e = np.array([-np.sin(lo), np.cos(lo), 0.0])
    n = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    u = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    return e, n, u


def reproject_altaz(alt_deg, az_deg, lat0, lon0, lat1, lon1):
    """Alt/az of a very distant body seen from (lat0, lon0) -> seen from (lat1, lon1).

    Exact rotation of the local East-North-Up frame on a sphere; parallax ignored
    (Earth: < 0.0002 deg per km, Sun: far less).
    """
    alt, az = np.radians(np.asarray(alt_deg, float)), np.radians(np.asarray(az_deg, float))
    e0, n0, u0 = _enu(lat0, lon0)
    d = (np.cos(alt) * np.sin(az))[..., None] * e0 + (np.cos(alt) * np.cos(az))[..., None] * n0 \
        + np.sin(alt)[..., None] * u0
    e1, n1, u1 = _enu(lat1, lon1)
    alt1 = np.degrees(np.arcsin(np.clip(d @ u1, -1, 1)))
    az1 = np.degrees(np.arctan2(d @ e1, d @ n1)) % 360.0
    return alt1, az1


def sun_radius_deg(times_utc):
    """Apparent solar angular radius from the date (Earth-orbit eccentricity), +/-0.3 %."""
    t = np.asarray(times_utc, dtype="datetime64[s]")
    doy = (t - t.astype("datetime64[Y]")).astype("timedelta64[s]").astype(float) / 86400.0
    return 0.26658 / (1.0 - 0.0167 * np.cos(2 * np.pi * (doy - 3.0) / 365.25))


def candidate_grid(lat, lon, radius_m=1000.0, spacing_m=100.0):
    """Points on a square grid (local metres) inside a circle around (lat, lon).

    Returns (lat, lon, distance_m, bearing_deg) arrays; the centre is included.
    """
    k = np.arange(-np.floor(radius_m / spacing_m), np.floor(radius_m / spacing_m) + 1) * spacing_m
    X, Y = np.meshgrid(k, k)                      # X east, Y north (metres)
    dist = np.hypot(X, Y).ravel()
    bearing = (np.degrees(np.arctan2(X, Y)).ravel()) % 360.0
    keep = dist <= radius_m + 1e-6
    dist, bearing = dist[keep], bearing[keep]
    la, lo = destination(lat, lon, bearing, dist)
    return np.asarray(la), np.asarray(lo), dist, bearing


def slope_deg(sample_height, lat, lon, baseline_m=40.0):
    """Terrain slope from central differences over +/- baseline_m (N-S and E-W)."""
    lat, lon = np.atleast_1d(lat).astype(float), np.atleast_1d(lon).astype(float)
    pts = [destination(lat, lon, a, baseline_m) for a in (0.0, 180.0, 90.0, 270.0)]
    hN, hS, hE, hW = (sample_height(np.asarray(p[0]), np.asarray(p[1])) for p in pts)
    gy = (hN - hS) / (2 * baseline_m)
    gx = (hE - hW) / (2 * baseline_m)
    return np.degrees(np.arctan(np.hypot(gx, gy)))


@dataclass
class CandidateScore:
    lat: float
    lon: float
    distance_m: float
    bearing_deg: float
    slope_deg: float
    sun_frac: float          # share of hours with >= 50 % of the solar disk above terrain
    earth_frac: float        # share of hours with Earth above terrain
    both_frac: float         # share of hours with both (the objective)


def score_point(vis, lat0, lon0, lat1, lon1, horizon: HorizonProfile, sun_radius=None):
    """Visibility series at (lat1, lon1) from the cited site's series `vis`."""
    sun_alt, sun_az = reproject_altaz(vis.sun_alt, vis.sun_az, lat0, lon0, lat1, lon1)
    earth_alt, earth_az = reproject_altaz(vis.earth_alt, vis.earth_az, lat0, lon0, lat1, lon1)
    r = sun_radius_deg(vis.times_utc) if sun_radius is None else sun_radius
    sun_h, earth_h = horizon.at(sun_az), horizon.at(earth_az)
    frac = disk_visible_fraction(sun_alt, sun_h, r)
    return dict(sun_alt=sun_alt, sun_az=sun_az, sun_horizon=sun_h, sun_fraction=frac,
                earth_alt=earth_alt, earth_az=earth_az, earth_horizon=earth_h,
                earth_visible=earth_alt > earth_h)


def rank_candidates(vis, lat0, lon0, candidates, horizon_fn, sample_height,
                    max_slope_deg=10.0) -> list[CandidateScore]:
    """Score every candidate; returns them best first (objective, then sun).

    candidates   = output of candidate_grid
    horizon_fn   = callable(lat, lon) -> HorizonProfile
    Candidates steeper than max_slope_deg are dropped.
    """
    la, lo, dist, bear = candidates
    slopes = slope_deg(sample_height, la, lo)
    out = []
    for a, b, d, br, s in zip(la, lo, dist, bear, slopes):
        if not np.isfinite(s) or s > max_slope_deg:
            continue
        z = score_point(vis, lat0, lon0, a, b, horizon_fn(a, b))
        lit = z["sun_fraction"] >= 0.5
        out.append(CandidateScore(float(a), float(b), float(d), float(br), float(s),
                                  float(lit.mean()), float(z["earth_visible"].mean()),
                                  float((lit & z["earth_visible"]).mean())))
    out.sort(key=lambda c: (c.both_frac, c.sun_frac, -c.distance_m), reverse=True)
    return out
