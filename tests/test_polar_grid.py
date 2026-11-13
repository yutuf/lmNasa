"""The compact polar height map (data/polar_grid.npz) against the full-resolution horizons.

When the grid was added (13 Nov 2026) horizons traced from it for 27 sites with full-resolution profiles
(LOLA 40 m, data/horizons.json) gave the same sunlit share within 0.5 points (median; worst 4.1) and the same
Earth-in-view share within 0.0 points (median; worst 13.9, a narrow crest). This test keeps a few of them
honest with looser bounds than those measured.
"""
import numpy as np
import pytest

from lunanav.derive import score_point
from lunanav.horizon import compute_horizon, load_profiles
from lunanav.polar_grid import GRID_FILE, PolarGrid
from lunanav.series import load_series

pytestmark = pytest.mark.skipif(not GRID_FILE.exists(), reason="no data/polar_grid.npz")
SITES = ["shackleton_ridge", "malapert_massif", "malapert_massif_region_best", "mons_mouton", "artemis_haworth"]


@pytest.fixture(scope="module")
def grid():
    return PolarGrid.load()


def test_known_heights(grid):
    # Shackleton's floor is near -2.8 km and its rim ridge near +1.95 km in LOLA
    assert grid.sample_height(np.array([-89.67]), np.array([129.78]))[0] < -2500
    assert grid.sample_height(np.array([-89.4395]), np.array([-137.1934]))[0] > 1800
    assert np.isnan(grid.sample_height(np.array([-70.0]), np.array([0.0]))[0])     # outside both grids


@pytest.mark.parametrize("site_id", SITES)
def test_matches_full_resolution(grid, site_id):
    ref = load_profiles(GRID_FILE.with_name("horizons.json"))[site_id]
    mine = compute_horizon(grid.sample_height, site_id, ref.lat, ref.lon, step_m=200.0)
    assert np.median(np.abs(np.array(mine.elevations_deg) - np.array(ref.elevations_deg))) < 0.2
    v, _, _ = load_series(site_id)
    p = score_point(v, ref.lat, ref.lon, ref.lat, ref.lon, mine)
    assert abs(np.mean(p["sun_fraction"] >= 0.5) - np.mean(v.sun_fraction >= 0.5)) < 0.05
    assert abs(np.mean(p["earth_visible"]) - np.mean(v.earth_visible)) < 0.05
