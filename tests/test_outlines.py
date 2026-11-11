"""lunanav.outlines: ring chaining and inside tests on synthetic outlines, plus the committed data."""
from pathlib import Path

import pytest

from lunanav.outlines import RegionOutlines, chain

ROOT = Path(__file__).resolve().parent.parent


def _square(lat0, lon0, dlat, dlon):
    """Four edges of a lat/lon box, deliberately out of order and one reversed."""
    a, b, c, d = (lat0, lon0), (lat0, lon0 + dlon), (lat0 + dlat, lon0 + dlon), (lat0 + dlat, lon0)
    return [[a, b], [c, d], [c, b], [d, a]]          # third edge runs backwards


def test_chain_closes_a_ring_from_shuffled_edges():
    rings = chain(_square(-86.0, 10.0, 0.2, 4.0))
    assert len(rings) == 1 and tuple(rings[0][0]) == tuple(rings[0][-1]) and len(rings[0]) == 5


def test_chain_rejects_an_open_outline():
    with pytest.raises(ValueError):
        chain([[(-86.0, 10.0), (-86.0, 11.0)], [(-85.0, 11.0), (-85.0, 10.0)]])


def test_regions_at_inside_outside_and_overlap():
    ro = RegionOutlines({"regions": {
        "A": {"name": "Alpha", "site": "a", "area_km2": 1, "lines": _square(-86.0, 10.0, 0.4, 6.0)},
        "B": {"name": "Beta", "site": "b", "area_km2": 1, "lines": _square(-85.8, 13.0, 0.4, 6.0)},
    }})
    assert ro.regions_at(-85.9, 11.0) == ["Alpha"]
    assert ro.regions_at(-85.7, 14.0) == ["Alpha", "Beta"]            # overlap -> both
    assert ro.regions_at(-85.5, 18.0) == ["Beta"]
    assert ro.regions_at(-84.0, 11.0) == [] and ro.regions_at(-89.0, 100.0) == []


def test_committed_outlines_place_known_points():
    ro = RegionOutlines.load(ROOT / "data" / "artemis_regions.json")
    if ro is None:
        pytest.skip("no outlines committed")
    assert len(ro.regions) == 9
    assert ro.regions_at(-84.7906, 29.1957) == ["Mons Mouton Plateau"]   # IM-2 Athena (LROC 1408)
    assert ro.regions_at(-86.0, 0.0) == ["Malapert Massif"]              # Malapert published point
    assert ro.regions_at(-89.4395, -137.1934) == []                      # Shackleton ridge: no region
