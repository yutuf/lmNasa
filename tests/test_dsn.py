"""The committed DSN visibility data (data/dsn.npz) and its loader."""
from pathlib import Path

import numpy as np
import pytest

from lunanav.dsn import DSN

ROOT = Path(__file__).resolve().parent.parent
dsn = DSN.load()
pytestmark = pytest.mark.skipif(dsn is None, reason="no data/dsn.npz")


def test_same_hours_as_the_series():
    times = np.load(ROOT / "data" / "series" / "apollo_11.npz")["times"].astype(np.int64)
    assert np.array_equal(dsn.times, times)


def test_three_complexes_with_plausible_geometry():
    assert dsn.stations == ["Goldstone", "Madrid", "Canberra"]
    above = dsn.elevation_deg > 10
    for k in range(3):                                   # each complex sees the Moon well under half the time
        assert 0.3 < above[k].mean() < 0.5
    assert 0.9 < above.any(axis=0).mean() < 1.0          # together almost always, but with gaps
    assert np.abs(dsn.elevation_deg).max() <= 90


def test_any_in_view_aligns_to_given_times():
    t = (dsn.times[:48]).astype("datetime64[s]")
    got = dsn.any_in_view(t)
    assert np.array_equal(got, (dsn.elevation_deg[:, :48] > 10).any(axis=0))
    assert not dsn.any_in_view(np.array(["1990-01-01T00:00"], dtype="datetime64[s]"))[0]
