"""Sun and Earth tracks and terrain horizons for any point on the Moon, without kernels or the full DEMs.

Sun/Earth: a computed site's hourly alt/az series is rotated into the new point's local frame. The Sun's
direction is the same from every point on the Moon (its parallax across the Moon is below 0.001 deg), so the
rotation is exact for it. For Earth the parallax (up to about 0.26 deg) is corrected with the hourly Earth-Moon
distance (data/earth_distance.npz): Earth's position is rebuilt in Moon-fixed coordinates from the source site
and seen again from the new point.

Terrain: data/global_grid.npz holds the LOLA global grid (LDEM_16, 16 pixels per degree, about 1.9 km at the
equator); GlobalGrid.sample_height feeds lunanav.horizon.compute_horizon.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

R_MOON_KM = 1737.4
DATA = Path(__file__).resolve().parent.parent / "data"


def _enu(lat_deg, lon_deg):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    e = np.array([-np.sin(lo), np.cos(lo), 0.0])
    n = np.array([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)])
    u = np.array([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    return e, n, u


def _direction(alt_deg, az_deg, lat, lon):
    alt, az = np.radians(np.asarray(alt_deg, float)), np.radians(np.asarray(az_deg, float))
    e, n, u = _enu(lat, lon)
    return ((np.cos(alt) * np.sin(az))[..., None] * e + (np.cos(alt) * np.cos(az))[..., None] * n
            + np.sin(alt)[..., None] * u)


def _altaz(d, lat, lon):
    e, n, u = _enu(lat, lon)
    d = d / np.linalg.norm(d, axis=-1, keepdims=True)
    return np.degrees(np.arcsin(np.clip(d @ u, -1, 1))), np.degrees(np.arctan2(d @ e, d @ n)) % 360.0


def rotate_sun(alt_deg, az_deg, lat0, lon0, lat1, lon1):
    """Sun alt/az seen from (lat1, lon1), from its alt/az at (lat0, lon0)."""
    return _altaz(_direction(alt_deg, az_deg, lat0, lon0), lat1, lon1)


def rotate_earth(alt_deg, az_deg, earth_moon_km, lat0, lon0, lat1, lon1):
    """Earth alt/az seen from (lat1, lon1), with parallax, from its alt/az at (lat0, lon0)."""
    d0 = _direction(alt_deg, az_deg, lat0, lon0)
    p0 = R_MOON_KM * _enu(lat0, lon0)[2]
    p1 = R_MOON_KM * _enu(lat1, lon1)[2]
    b = d0 @ p0                                       # |p0 + s d0| = D  ->  s^2 + 2 b s + |p0|^2 - D^2 = 0
    s = -b + np.sqrt(b * b - R_MOON_KM ** 2 + np.asarray(earth_moon_km, float) ** 2)
    earth = p0 + s[..., None] * d0
    return _altaz(earth - p1, lat1, lon1)


def load_earth_distance(path: str | Path = DATA / "earth_distance.npz"):
    p = Path(path)
    if not p.exists():
        return None
    z = np.load(p, allow_pickle=False)
    return z["times"].astype(np.int64), z["earth_moon_km"].astype(np.float64)


class GlobalGrid:
    """LOLA global simple-cylindrical grid: rows from 90 N down, columns from 0 E eastward."""

    def __init__(self, dn: np.ndarray, ppd: float, scale: float, source: str):
        self.h = dn.astype(np.float32) * scale
        self.ppd, self.source = ppd, source

    @classmethod
    def load(cls, path: str | Path = DATA / "global_grid.npz") -> "GlobalGrid | None":
        p = Path(path)
        if not p.exists():
            return None
        z = np.load(p, allow_pickle=False)
        return cls(z["dn"], float(z["ppd"]), float(z["scale"]), str(z["source"]))

    def sample_height(self, lat_deg, lon_deg):
        lat = np.atleast_1d(np.asarray(lat_deg, float))
        lon = np.atleast_1d(np.asarray(lon_deg, float)) % 360.0
        col = self.ppd * lon - 0.5
        row = self.ppd * (90.0 - lat) - 0.5
        n_r, n_c = self.h.shape
        c0, r0 = np.floor(col).astype(int), np.clip(np.floor(row).astype(int), 0, n_r - 2)
        fc, fr = col - np.floor(col), np.clip(row - r0, 0.0, 1.0)
        c0, c1 = c0 % n_c, (c0 + 1) % n_c
        h = self.h
        return (h[r0, c0] * (1 - fc) * (1 - fr) + h[r0, c1] * fc * (1 - fr)
                + h[r0 + 1, c0] * (1 - fc) * fr + h[r0 + 1, c1] * fc * fr)
