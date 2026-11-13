"""Sun/Earth tracks rotated to any point, and the global height grid.

When this was added (14 Nov 2026), rotating one site's DE440 series to another site and comparing with that
site's own independent DE440 series gave at most 0.018 deg for the Sun and 0.017 deg for Earth with the parallax
correction (south pole <-> Apollo 11, about 2,700 km apart); without it Earth was off by up to 0.33 deg.
"""
from pathlib import Path

import numpy as np
import pytest

from lunanav.anywhere import GlobalGrid, load_earth_distance, rotate_earth, rotate_sun
from lunanav.series import load_series
from lunanav.sites import load_sites

ROOT = Path(__file__).resolve().parent.parent
pytestmark = pytest.mark.skipif(load_earth_distance() is None, reason="no data/earth_distance.npz")


def _sep(a1, z1, a2, z2):
    a1, z1, a2, z2 = (np.radians(np.asarray(x, float)) for x in (a1, z1, a2, z2))
    c = np.sin(a1) * np.sin(a2) + np.cos(a1) * np.cos(a2) * np.cos(z1 - z2)
    return np.degrees(np.arccos(np.clip(c, -1, 1)))


@pytest.mark.parametrize("src,dst", [("shackleton_ridge", "apollo_11"), ("apollo_11", "malapert_massif")])
def test_rotation_matches_independent_runs(src, dst):
    sites = {s.id: s for s in load_sites()}
    va, vb = load_series(src)[0], load_series(dst)[0]
    _, km = load_earth_distance()
    a, b = sites[src], sites[dst]
    s_alt, s_az = rotate_sun(va.sun_alt, va.sun_az, a.lat, a.lon, b.lat, b.lon)
    e_alt, e_az = rotate_earth(va.earth_alt, va.earth_az, km, a.lat, a.lon, b.lat, b.lon)
    assert _sep(s_alt, s_az, vb.sun_alt, vb.sun_az).max() < 0.03
    assert _sep(e_alt, e_az, vb.earth_alt, vb.earth_az).max() < 0.03


@pytest.mark.skipif(not (ROOT / "data" / "global_grid.npz").exists(), reason="no global grid")
def test_global_grid_orientation():
    g = GlobalGrid.load()
    # Shackleton's floor is deep and its connecting ridge high; Mare Tranquillitatis (Apollo 11) lies low
    assert g.sample_height(-89.67, 129.78)[0] < -1500
    assert g.sample_height(-89.44, -137.19)[0] > 1000
    assert g.sample_height(0.674, 23.473)[0] < -1000
    assert np.isfinite(g.sample_height(np.array([0.0, 45.0, -45.0]), np.array([179.9, -179.9, 0.0]))).all()
