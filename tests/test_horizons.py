"""LunaNav's Sun/Earth positions against official JPL Horizons output (no network needed).

tests/fixtures/horizons.json holds apparent azimuth/elevation from the Horizons API (DE441, observer at
coord@301, 2 m above the 1737.4 km sphere, airless) for the Sun and Earth seen from three sites, every
6 h through January 2027: 3 sites x 2 bodies x 121 times = 726 positions. It was fetched once with
scripts/fetch_horizons_fixture.py. The committed series in data/series/ (DE440 via Skyfield,
lunanav/ephemeris.py, stored as float32) are compared against it.

Measured when the fixture was added (13 Nov 2026): largest angular separation 0.000015 deg, largest
altitude difference 0.000004 deg. That is the size of float32 rounding at these values, so the two
ephemerides agree to within the precision the series are stored at. The tolerance below is 0.0001 deg,
about six times the measured worst case.
"""
import json
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "horizons.json"
TOL_DEG = 0.0001


def _pairs():
    fx = json.loads(FIXTURE.read_text(encoding="utf-8"))
    for site_id, entry in fx["sites"].items():
        for body in ("sun", "earth"):
            yield site_id, body, entry[body]


@pytest.mark.parametrize("site_id,body,rows", list(_pairs()), ids=lambda p: p if isinstance(p, str) else "")
def test_series_match_horizons(site_id, body, rows):
    z = np.load(ROOT / "data" / "series" / f"{site_id}.npz")
    times = z["times"].astype("datetime64[s]")
    want_t = np.array([np.datetime64(r["utc"], "s") for r in rows])
    idx = np.searchsorted(times, want_t)
    assert np.all(idx < len(times)) and np.all(times[idx] == want_t), "fixture times missing from the series"

    alt = np.radians(z[f"{body}_alt"][idx].astype(float))
    az = np.radians(z[f"{body}_az"][idx].astype(float))
    h_alt = np.radians([r["el_deg"] for r in rows])
    h_az = np.radians([r["az_deg"] for r in rows])
    cos_sep = np.sin(alt) * np.sin(h_alt) + np.cos(alt) * np.cos(h_alt) * np.cos(az - h_az)
    sep = np.degrees(np.arccos(np.clip(cos_sep, -1.0, 1.0)))

    assert len(rows) == 121
    assert sep.max() < TOL_DEG, f"{site_id} {body}: max separation {sep.max():.6f} deg"
    assert np.degrees(np.abs(alt - h_alt)).max() < TOL_DEG
