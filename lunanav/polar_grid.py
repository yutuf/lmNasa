"""A compact south-polar height map for horizons at any point, without rasterio or the full DEMs.

data/polar_grid.npz (scripts/make_polar_grid.py) holds two LOLA grids in south polar stereographic
projection: a fine one (200 m, from the 85 deg S product) and a coarse one (800 m, from the 80 deg S product)
for far terrain. sample_height() is a bilinear sampler with the signature lunanav.horizon.compute_horizon
expects, so a horizon can be traced for any point south of about 84 deg S while the app runs.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

R_MOON_M = 1_737_400.0
GRID_FILE = Path(__file__).resolve().parent.parent / "data" / "polar_grid.npz"


def polar_xy(lat_deg, lon_deg):
    """South polar stereographic, metres: +x toward lon 90 E, +y toward lon 0."""
    r = 2.0 * R_MOON_M * np.tan(np.radians(90.0 + np.asarray(lat_deg, float)) / 2.0)
    lon = np.radians(np.asarray(lon_deg, float))
    return r * np.sin(lon), r * np.cos(lon)


class _Grid:
    def __init__(self, dn, m_per_px, line0, sample0, scale):
        self.h = dn.astype(np.float32) * scale
        self.m_per_px, self.line0, self.sample0 = m_per_px, line0, sample0

    def sample(self, x, y):
        col = self.sample0 + x / self.m_per_px
        row = self.line0 - y / self.m_per_px
        c0, r0 = np.floor(col).astype(int), np.floor(row).astype(int)
        fc, fr = col - c0, row - r0
        n_r, n_c = self.h.shape
        ok = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < n_c) & (r0 + 1 < n_r)
        out = np.full(np.shape(col), np.nan)
        c, r, a, b = c0[ok], r0[ok], fc[ok], fr[ok]
        h = self.h
        out[ok] = (h[r, c] * (1 - a) * (1 - b) + h[r, c + 1] * a * (1 - b)
                   + h[r + 1, c] * (1 - a) * b + h[r + 1, c + 1] * a * b)
        return out


class PolarGrid:
    def __init__(self, fine: _Grid, coarse: _Grid, source: str):
        self.fine, self.coarse, self.source = fine, coarse, source

    @classmethod
    def load(cls, path: str | Path = GRID_FILE) -> "PolarGrid | None":
        p = Path(path)
        if not p.exists():
            return None
        z = np.load(p, allow_pickle=False)
        grids = [_Grid(z[f"{k}_dn"], float(z[f"{k}_m_per_px"]), float(z[f"{k}_line0"]), float(z[f"{k}_sample0"]),
                       float(z["scale"])) for k in ("fine", "coarse")]
        return cls(*grids, source=str(z["source"]))

    def sample_height(self, lat_deg, lon_deg):
        x, y = polar_xy(lat_deg, lon_deg)
        x, y = np.atleast_1d(x), np.atleast_1d(y)
        out = self.fine.sample(x, y)
        miss = ~np.isfinite(out)
        if miss.any():
            out[miss] = self.coarse.sample(x[miss], y[miss])
        return out
