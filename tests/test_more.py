"""Tests for the panorama helpers, batch battery model, timers and derived points."""
import numpy as np
import pytest
import yaml

from lunanav.derive import (candidate_grid, rank_candidates, reproject_altaz, score_point, slope_deg,
                            sun_radius_deg)
from lunanav.geometry import MOON_RADIUS_M, destination
from lunanav.horizon import HorizonProfile
from lunanav.metrics import hours_until_change
from lunanav.panorama import break_at_wraps, circular_mean_deg, compass_ticks, unwrap_about
from lunanav.power import PowerConfig, simulate_battery, simulate_battery_batch
from lunanav.sites import load_sites
from lunanav.visibility import Visibility


# ---------------- panorama helpers ----------------
def test_circular_mean_across_north():
    assert circular_mean_deg([350, 10]) == pytest.approx(0.0, abs=1e-9) or \
        circular_mean_deg([350, 10]) == pytest.approx(360.0, abs=1e-9)
    assert circular_mean_deg([80, 100]) == pytest.approx(90.0)


def test_unwrap_about_range_and_identity():
    x = unwrap_about([0, 90, 180, 270, 359], 10.0)
    assert np.all(x >= 10 - 180) and np.all(x < 10 + 180)
    assert np.allclose(np.asarray(x) % 360, [0, 90, 180, 270, 359])


def test_break_at_wraps_inserts_nan():
    x, y = break_at_wraps([170, 175, -175, -170], [1, 2, 3, 4])
    assert np.isnan(x[2]) and np.isnan(y[2]) and len(x) == 5


def test_compass_ticks_labels():
    vals, labels = compass_ticks(-100, 100)
    assert vals == [-90, -45, 0, 45, 90]
    assert labels == ["W", "NW", "N", "NE", "E"]


# ---------------- timers ----------------
def test_hours_until_change():
    m = [True, True, False, False, True]
    assert hours_until_change(m, 0, 1.0) == 2.0
    assert hours_until_change(m, 2, 0.5) == 1.0
    assert hours_until_change(m, 4, 1.0) is None          # never changes again
    assert hours_until_change([True] * 5, 0, 1.0) is None


# ---------------- battery: batch == single ----------------
def test_battery_batch_matches_single():
    rng = np.random.default_rng(1)
    sf = rng.uniform(0, 1, (6, 200)) * (rng.uniform(0, 1, (6, 200)) > 0.3)
    cfg = PowerConfig(array_peak_w=300, load_w=150, battery_wh=1500)
    batch = simulate_battery_batch(sf, 1.0, cfg)
    for row, b in zip(sf, batch):
        s = simulate_battery(row, None, 1.0, cfg)
        assert np.allclose(s.soc, b.soc) and s.survived == b.survived
        assert s.first_failure_index == b.first_failure_index and s.min_soc == pytest.approx(b.min_soc)


# ---------------- derived points ----------------
def test_reproject_identity():
    alt, az = np.array([0.5, 3.0, -1.0]), np.array([10.0, 200.0, 359.0])
    a2, z2 = reproject_altaz(alt, az, -89.4, -137.0, -89.4, -137.0)
    assert np.allclose(a2, alt, atol=1e-9) and np.allclose(z2, az, atol=1e-9)


def test_reproject_moving_toward_body_raises_it_by_d_over_R():
    lat0, lon0, d = -88.0, 30.0, 1000.0
    lat1, lon1 = destination(lat0, lon0, 0.0, d)              # move 1 km north
    a2, _ = reproject_altaz(np.array([0.0]), np.array([0.0]), lat0, lon0, float(lat1), float(lon1))
    assert a2[0] == pytest.approx(np.degrees(d / MOON_RADIUS_M), rel=1e-3)
    a3, _ = reproject_altaz(np.array([0.0]), np.array([180.0]), lat0, lon0, float(lat1), float(lon1))
    assert a3[0] == pytest.approx(-np.degrees(d / MOON_RADIUS_M), rel=1e-3)


def test_sun_radius_perihelion_aphelion():
    r = sun_radius_deg(np.array(["2027-01-03", "2027-07-04"], dtype="datetime64[s]"))
    assert r[0] > r[1] and 0.26 < r[1] < r[0] < 0.275


def test_candidate_grid_inside_radius_and_has_centre():
    la, lo, dist, bear = candidate_grid(-89.0, 45.0, 1000.0, 100.0)
    assert dist.max() <= 1000.0 + 1e-6 and (dist == 0).sum() == 1
    assert 300 < len(la) < 330                               # ~ pi * 10^2 grid points


def test_slope_of_tilted_plane():
    # height rises 0.1 m per metre northward (5.71 deg) -- sampler in lat only
    lat0 = -88.0
    plane = lambda la, lo: (np.asarray(la) - lat0) * np.radians(1) * MOON_RADIUS_M * 0.1  # noqa: E731
    assert slope_deg(plane, lat0, 10.0)[0] == pytest.approx(np.degrees(np.arctan(0.1)), abs=0.05)


def _toy_vis(n=240):
    t = np.datetime64("2027-01-01T00:00:00") + np.arange(n).astype("timedelta64[h]")
    sun_az = (np.arange(n) * 360 / n) % 360            # Sun circles the horizon
    return Visibility(t, np.full(n, 1.0), sun_az, np.zeros(n), np.ones(n),
                      np.full(n, 2.0), np.full(n, 0.0), np.zeros(n), np.ones(n, bool))


def test_rank_candidates_prefers_unblocked_and_respects_slope():
    lat0, lon0 = -88.0, 0.0
    vis = _toy_vis()
    cand = candidate_grid(lat0, lon0, 500.0, 250.0)
    _, _, dist, bear = cand

    def horizon_fn(la, lo):
        # a 5-degree wall toward azimuth 90-180 everywhere except at the point 250 m north
        el = np.where((np.arange(360) >= 90) & (np.arange(360) <= 180), 5.0, 0.0)
        if abs(la - destination(lat0, lon0, 0.0, 250.0)[0]) < 1e-6 and abs(lo - lon0) < 1e-6:
            el = np.zeros(360)
        return HorizonProfile("c", la, lo, list(range(360)), el.tolist(), 2.0, 0.0, "toy")

    flat = lambda la, lo: np.zeros(np.shape(la))  # noqa: E731
    ranked = rank_candidates(vis, lat0, lon0, cand, horizon_fn, flat, max_slope_deg=10)
    assert ranked[0].distance_m == pytest.approx(250.0) and ranked[0].bearing_deg == pytest.approx(0.0)
    assert ranked[0].both_frac == pytest.approx(1.0) and ranked[-1].both_frac < 1.0
    steep = lambda la, lo: (np.asarray(la) - lat0) * np.radians(1) * MOON_RADIUS_M  # noqa: E731  45 deg
    assert rank_candidates(vis, lat0, lon0, cand, horizon_fn, steep, max_slope_deg=10) == []


def test_score_point_at_cited_point_reproduces_series():
    vis = _toy_vis()
    hz = HorizonProfile.flat("x", -88.0, 0.0)
    z = score_point(vis, -88.0, 0.0, -88.0, 0.0, hz)
    assert np.allclose(z["sun_alt"], vis.sun_alt) and z["earth_visible"].all()


def test_load_sites_places_derived_after_parent(tmp_path):
    (tmp_path / "sites.yaml").write_text(yaml.safe_dump({"sites": [
        dict(id="a", name="A", lat=-89, lon=0), dict(id="b", name="B", lat=-88, lon=0)]}))
    (tmp_path / "derived_sites.yaml").write_text(yaml.safe_dump({"sites": [
        dict(id="a_derived", name="A d", lat=-89.001, lon=0, derived_from="a", distance_m=100,
             bearing_deg=0, slope_deg=2, cited_slope_deg=1)]}))
    s = load_sites(tmp_path / "sites.yaml")
    assert [x.id for x in s] == ["a", "a_derived", "b"] and s[1].derived and not s[0].derived
    assert [x.id for x in load_sites(tmp_path / "sites.yaml", include_derived=False)] == ["a", "b"]


def test_required_battery_is_exact_threshold():
    from dataclasses import replace

    from lunanav.power import required_battery_wh
    rng = np.random.default_rng(3)
    sf = np.repeat(rng.uniform(0, 1, 40) > 0.5, 12).astype(float)    # 12 h sun / shadow blocks
    cfg = PowerConfig(array_peak_w=400, load_w=150, min_soc=0.2)
    need = required_battery_wh(sf, 1.0, cfg)
    assert 0 < need < np.inf
    ok = simulate_battery(sf, None, 1.0, replace(cfg, battery_wh=need * 1.001))
    bad = simulate_battery(sf, None, 1.0, replace(cfg, battery_wh=need * 0.99))
    assert ok.survived and not bad.survived
    assert required_battery_wh(np.ones(50), 1.0, cfg) == 0.0
