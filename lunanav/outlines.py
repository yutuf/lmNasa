"""Artemis III region outlines for the app (pure numpy: no pyshp/pyproj at runtime).

Reads data/artemis_regions.json (written by scripts/artemis_regions.py --outlines from
the USGS 1 km grids). Inside/outside is tested in a south-polar azimuthal-equidistant
plane (the app's map). The outline edges were split into <= 2 km pieces in the grid's
own projection, so the boundary differs from the exact grid edge by metres only.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

MOON_R_KM = 1737.4


def polar_xy(lat, lon):
    """South-polar azimuthal equidistant (km): 0 deg E up, 90 deg E right (same as the app map)."""
    rho = np.radians(90.0 + np.asarray(lat, float)) * MOON_R_KM
    lam = np.radians(np.asarray(lon, float))
    return rho * np.sin(lam), rho * np.cos(lam)


def chain(lines, ndigits=5):
    """Join open polylines that share end points into closed rings. Returns a list of (n, 2) arrays."""
    key = lambda p: (round(p[0], ndigits), round(p[1], ndigits))  # noqa: E731
    todo = [list(map(tuple, ln)) for ln in lines]
    rings = []
    while todo:
        ring = todo.pop(0)
        while key(ring[0]) != key(ring[-1]):
            for k, ln in enumerate(todo):
                if key(ln[0]) == key(ring[-1]):
                    ring += ln[1:]
                elif key(ln[-1]) == key(ring[-1]):
                    ring += ln[::-1][1:]
                else:
                    continue
                todo.pop(k)
                break
            else:
                raise ValueError("outline does not close")
        rings.append(np.asarray(ring, float))
    return rings


def _inside(px, py, ring_xy):
    """Even-odd ray casting; vectorised over points."""
    x, y = ring_xy[:, 0], ring_xy[:, 1]
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    px, py = np.asarray(px, float)[..., None], np.asarray(py, float)[..., None]
    crosses = ((y > py) != (y1 > py)) & (px < (x1 - x) * (py - y) / np.where(y1 == y, np.inf, y1 - y) + x)
    return crosses.sum(axis=-1) % 2 == 1


class RegionOutlines:
    def __init__(self, data: dict):
        self.source = data.get("source", "")
        self.regions = {}
        for token, r in data["regions"].items():
            rings_xy = [np.column_stack(polar_xy(rg[:, 0], rg[:, 1])) for rg in chain(r["lines"])]
            self.regions[token] = dict(r, rings_xy=rings_xy)

    @classmethod
    def load(cls, path) -> "RegionOutlines | None":
        p = Path(path)
        return cls(json.loads(p.read_text())) if p.exists() else None

    def regions_at(self, lat, lon) -> list[str]:
        """Display names of every Artemis III region containing (lat, lon). Regions can overlap
        (e.g. Mons Mouton overlaps Nobile Rim 1 and Mons Mouton Plateau), so this is a list."""
        px, py = polar_xy(lat, lon)
        return [r["name"] for r in self.regions.values() if any(_inside(px, py, rg) for rg in r["rings_xy"])]
