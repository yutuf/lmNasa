"""Every scene in docs/DEMO.md opens as described (so a data change cannot silently break the demo)."""
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
pytest.importorskip("streamlit.testing.v1")
if not any((ROOT / "data" / "series").glob("*.npz")):
    pytest.skip("no precomputed series", allow_module_level=True)

from streamlit.testing.v1 import AppTest  # noqa: E402

SCENES = [  # (url params, expected verdict, strings that must appear in the verdict or battery line)
    ({"site": "malapert_massif", "start": "2027-09-09T00:00"}, "NO-GO", ["sunlight 45%", "longest shadow 164 h"]),
    ({"site": "malapert_massif_derived", "start": "2027-09-09T00:00"}, "NO-GO", ["6,598 Wh"]),
    ({"site": "malapert_massif_derived", "start": "2027-09-09T00:00", "batt": "6600"}, "GO", ["90%", "Earth 100%"]),
    ({"site": "malapert_massif_region_best", "start": "2027-09-09T00:00"}, "GO", ["sunlight 100%", "Earth 100%"]),
    ({"site": "apollo_11", "start": "2026-11-01T00:00"}, "NO-GO", ["66,316 Wh"]),
    ({"site": "apollo_11", "start": "2027-02-12T00:00"}, "GO", ["none — the array covers the load"]),
]


@pytest.mark.parametrize("params,verdict,needles", SCENES, ids=[f"{p['site']}-{p.get('batt', '')}" for p, *_ in SCENES])
def test_demo_scene(params, verdict, needles):
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=180)
    at.query_params.update(params)
    at.run()
    assert not at.exception, at.exception
    text = " ".join([x.value for x in at.success] + [x.value for x in at.error]
                    + [c.value for c in at.caption if "Battery needed" in c.value])
    assert f"**{verdict}**" in text, text[:200]
    for n in needles:
        assert n in text, (n, text[:300])
    big = next(m.value for m in at.markdown if "font-size:52px" in m.value)     # the simple view's verdict
    assert f">{verdict}<" in big, big[:300]


def test_time_cursor_shows_sun_and_earth_altitude():
    """The readout under the time slider states both altitudes, taken from the same series the app plots."""
    import numpy as np

    from lunanav.series import load_series

    v, _, _ = load_series("malapert_massif")
    i = int(np.searchsorted(v.times_utc, np.datetime64("2027-09-09T00:00", "s")))
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=180)
    at.query_params.update({"site": "malapert_massif", "start": "2027-09-09T00:00"})
    at.run()
    assert not at.exception, at.exception
    readout = next(m.value for m in at.markdown if "UTC" in m.value and "Sun:" in m.value)
    assert f"altitude {v.sun_alt[i]:.2f}° above horizontal" in readout, readout
    assert f"altitude {v.earth_alt[i]:.2f}° above horizontal" in readout, readout
    assert any("Deep Space Network" in c.value for c in at.caption)                  # DSN explanation
    chips = " ".join(m.value for m in at.markdown if "1 month late" in m.value or "Shackleton ridge" in m.value)
    assert "1 week late" in chips and "Apollo 11 (equator)" in chips                  # slip + other spots
    assert any(s.label == "Hour of the mission" for s in at.slider)                   # 3D terrain scene
    viewers = next(c.value for c in at.caption if "QuickMap" in c.value)
    assert "https://quickmap.lroc.im-ldi.com/" in viewers and "https://trek.nasa.gov/moon/" in viewers
    assert "not computed from them" in viewers


def test_demo_doc_links_match_the_tested_scenes():
    doc = (ROOT / "docs" / "DEMO.md").read_text()
    for params, *_ in SCENES:
        assert "?" + "&".join(f"{k}={v}" for k, v in params.items()) in doc, params


def test_every_backup_screenshot_exists():
    doc = (ROOT / "docs" / "DEMO.md").read_text()
    import re
    imgs = re.findall(r"\((demo/[\w.]+\.png)\)", doc)
    assert len(imgs) == len(SCENES)
    for rel in imgs:
        assert (ROOT / "docs" / rel).stat().st_size > 10_000, rel


def test_any_point_matches_the_curated_best_spot():
    """Typing the coordinates of the region-best Malapert point gives the same verdict as the curated spot."""
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=300)
    at.query_params.update({"site": "malapert_massif", "start": "2027-09-09T00:00"})
    at.run()
    next(w for w in at.get("button_group") if "Landing spot" in str(w.proto.label)).set_value("custom").run()
    next(n for n in at.number_input if n.label.startswith("Latitude")).set_value(-85.967).run()
    next(n for n in at.number_input if n.label.startswith("Longitude")).set_value(-2.306).run()
    assert not at.exception, at.exception
    big = next(m.value for m in at.markdown if "font-size:52px" in m.value)
    assert ">GO<" in big, big[:300]
    assert any("Ground height" in c.value for c in at.caption)
