"""Consistency of the COMMITTED data (runs in CI; needs no DEM or kernels).

The data is produced offline on another machine and committed; these are the checks
that were done by hand on each delivery, so a bad delivery now fails visibly.
"""
from pathlib import Path

import numpy as np
import pytest

from lunanav.derive import score_point
from lunanav.geometry import distance_bearing
from lunanav.horizon import load_profiles
from lunanav.outlines import RegionOutlines
from lunanav.series import load_series
from lunanav.sites import load_sites

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SITES = load_sites()
BY_ID = {s.id: s for s in SITES}
SERIES = {s.id: load_series(s.id) for s in SITES}
COMPUTED = [s for s in SITES if SERIES[s.id][0] is not None]
HZ = load_profiles(DATA / "horizons.json") if (DATA / "horizons.json").exists() else {}

pytestmark = pytest.mark.skipif(not COMPUTED, reason="no committed series")


def test_site_ids_are_unique():
    ids = [s.id for s in SITES]
    assert len(ids) == len(set(ids))


def test_all_series_share_one_time_axis():
    ref = SERIES[COMPUTED[0].id]
    for s in COMPUTED:
        v, step, _ = SERIES[s.id]
        assert step == ref[1], s.id
        assert np.array_equal(v.times_utc, ref[0].times_utc), s.id


def test_every_computed_site_has_its_horizon_and_series_uses_it():
    """The app's 360-degree view reads horizons.json; the series must have been made with the same profile."""
    for s in COMPUTED:
        if s.lat > -80:                       # outside the polar DEM (Apollo 11): flat horizon by design
            continue
        assert s.id in HZ, f"{s.id}: no profile in horizons.json"
        v = SERIES[s.id][0]
        k = slice(None, None, 97)             # a sample of hours is enough
        assert np.allclose(HZ[s.id].at(v.sun_az[k]), v.sun_horizon[k], atol=2e-3), s.id
        assert np.allclose(HZ[s.id].at(v.earth_az[k]), v.earth_horizon[k], atol=2e-3), s.id


def test_visibility_flags_follow_from_the_stored_angles():
    for s in COMPUTED:
        v = SERIES[s.id][0]
        assert np.array_equal(v.earth_visible, v.earth_alt > v.earth_horizon), s.id
        assert ((v.sun_fraction >= 0) & (v.sun_fraction <= 1)).all(), s.id
        lit = v.sun_fraction > 0
        assert (v.sun_alt[lit] > v.sun_horizon[lit] - 0.3).all(), s.id   # disk radius ~0.27 deg


@pytest.mark.parametrize("d", [s for s in SITES if s.derived], ids=lambda s: s.id)
def test_derived_point(d):
    parent = BY_ID.get(d.derived_from)
    assert parent is not None and not parent.derived, f"{d.id}: parent {d.derived_from} missing"
    assert d.slope_deg is not None and d.slope_deg <= 10.0
    dist, bear = distance_bearing(parent.lat, parent.lon, d.lat, d.lon)
    assert abs(dist - d.distance_m) < 2.0, f"{d.id}: stated {d.distance_m} m, actual {dist:.1f} m"
    if d.distance_m > 5:
        assert abs((bear - d.bearing_deg + 180) % 360 - 180) < 0.5, d.id
    if d.search in ("", "1 km"):
        assert d.distance_m <= 1000.5, d.id
    else:
        assert d.search == "region", d.id
        ro = RegionOutlines.load(DATA / "artemis_regions.json")
        if ro is not None:
            assert ro.regions_at(d.lat, d.lon), f"{d.id}: best-in-region point is outside every region"
    if SERIES[d.id][0] is None or SERIES[parent.id][0] is None:
        pytest.skip("series not computed yet")
    # the derived series must be reproducible from the parent's sky series and the derived horizon
    v, vp = SERIES[d.id][0], SERIES[parent.id][0]
    assert d.id in HZ, f"{d.id}: no profile in horizons.json"
    z = score_point(vp, parent.lat, parent.lon, d.lat, d.lon, HZ[d.id])
    assert ((z["sun_fraction"] >= .5) == (v.sun_fraction >= .5)).mean() > 0.999, d.id
    assert (z["earth_visible"] == v.earth_visible).mean() > 0.999, d.id


def test_region_centres_have_a_source_and_slope_once_computed():
    for s in SITES:
        if s.category == "region_centre":
            assert "10.5066/P1MEQ6UK" in s.source, s.id
            if SERIES[s.id][0] is not None:
                assert s.slope_deg is not None, f"{s.id}: computed but no slope_deg in sites.yaml"
