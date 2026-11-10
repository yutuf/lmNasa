import numpy as np
import pytest

from lunanav.geometry import MOON_RADIUS_M, destination, disk_visible_fraction, elevation_angle_deg
from lunanav.horizon import HorizonProfile, compute_horizon
from lunanav.metrics import MissionConstraints, delay_tolerance, evaluate_window, longest_run, scan_start_dates
from lunanav.power import PowerConfig, simulate_battery
from lunanav.visibility import Visibility


def test_destination_north_and_distance():
    lat, lon = destination(0.0, 0.0, 0.0, MOON_RADIUS_M * np.radians(10))
    assert lat == pytest.approx(10.0, abs=1e-9) and lon == pytest.approx(0.0, abs=1e-9)
    lat, lon = destination(0.0, 0.0, 90.0, MOON_RADIUS_M * np.radians(10))
    assert lat == pytest.approx(0.0, abs=1e-9) and lon == pytest.approx(10.0, abs=1e-9)


def test_curvature_drops_flat_terrain_below_horizontal():
    # flat sphere: terrain at 10 km is below the observer's horizontal plane
    e = elevation_angle_deg(0.0, 0.0, 10_000.0)
    assert e < 0
    # analytic: -theta/2 for equal heights
    assert e == pytest.approx(-np.degrees(10_000 / MOON_RADIUS_M) / 2, rel=1e-6)


def test_disk_fraction():
    assert disk_visible_fraction(1.0, 0.0, 0.27) == pytest.approx(1.0)
    assert disk_visible_fraction(-1.0, 0.0, 0.27) == pytest.approx(0.0)
    assert disk_visible_fraction(0.0, 0.0, 0.27) == pytest.approx(0.5)


def test_horizon_sees_mountain_only_in_its_direction():
    # 2 km-high wall 20 km due east of a point near the south pole
    site_lat, site_lon = -85.0, 0.0
    wall_lat, wall_lon = destination(site_lat, site_lon, 90.0, 20_000.0)

    def sampler(lat, lon):
        lat, lon = np.asarray(lat), np.asarray(lon)
        # great-circle distance to the wall point
        p1, p2 = np.radians(lat), np.radians(wall_lat)
        dl = np.radians(lon - wall_lon)
        c = np.sin(p1) * np.sin(p2) + np.cos(p1) * np.cos(p2) * np.cos(dl)
        d = MOON_RADIUS_M * np.arccos(np.clip(c, -1, 1))
        return 2000.0 * np.exp(-(d / 3000.0) ** 2)

    hz = compute_horizon(sampler, "t", site_lat, site_lon, max_distance_m=40_000, step_m=100)
    east, west = hz.at(90.0), hz.at(270.0)
    expected = np.degrees(np.arctan2(2000 - 20_000**2 / (2 * MOON_RADIUS_M), 20_000))
    assert east == pytest.approx(expected, abs=0.3)
    assert west < 0.0  # nothing but curvature to the west


def test_battery_survives_with_sun_dies_without():
    cfg = PowerConfig(array_peak_w=400, load_w=150, battery_wh=1000, initial_soc=1.0, min_soc=0.2)
    n = 24 * 5
    lit = simulate_battery(np.ones(n), np.zeros(n), 1.0, cfg)
    dark = simulate_battery(np.zeros(n), np.zeros(n), 1.0, cfg)
    assert lit.survived and lit.min_soc == pytest.approx(1.0)
    assert not dark.survived
    # 800 Wh usable above min_soc / (150 W / 0.95) -> fails at ~hour 5
    assert dark.first_failure_index == pytest.approx(5, abs=1)


def test_longest_run():
    assert longest_run(np.array([0, 1, 1, 0, 1, 1, 1, 0], bool)) == 3
    assert longest_run(np.zeros(4, bool)) == 0


def _vis(sun_frac, earth_vis):
    n = len(sun_frac)
    t = np.datetime64("2027-01-01T00:00") + np.arange(n) * np.timedelta64(1, "h")
    z = np.zeros(n)
    return Visibility(t, z, z, z, np.asarray(sun_frac, float), z, z, z, np.asarray(earth_vis, bool))


def test_scoring_prefers_better_windows_and_flags_failures():
    c = MissionConstraints(duration_days=2, min_sun_frac=0.7, min_comm_frac=0.5, max_dark_hours=12)
    good = evaluate_window(np.ones(48), np.zeros(48), np.ones(48, bool), 1.0, c)
    bad = evaluate_window(np.zeros(48), np.zeros(48), np.zeros(48, bool), 1.0, c)
    assert good.meets_constraints and good.score > 90
    assert not bad.meets_constraints and bad.score < good.score and bad.fail_reasons


def test_scan_start_dates_shapes():
    c = MissionConstraints(duration_days=2)
    v = _vis(np.r_[np.ones(72), np.zeros(72)], np.ones(144, bool))
    starts, res = scan_start_dates(v, 1.0, c, start_stride_h=24)
    assert len(starts) == len(res) == 5
    assert res[0].score > res[-1].score  # early starts are sunlit, late ones are dark


def test_flat_profile():
    hz = HorizonProfile.flat("x", 0, 0)
    assert hz.at(123.4) == 0.0


def test_delay_tolerance():
    f = [True, True, True, False, True]
    assert delay_tolerance(f, 24).tolist() == [48, 24, 0, -1, 0]
