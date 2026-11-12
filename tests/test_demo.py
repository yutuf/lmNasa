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


def test_demo_doc_links_match_the_tested_scenes():
    doc = (ROOT / "docs" / "DEMO.md").read_text()
    for params, *_ in SCENES:
        assert "?" + "&".join(f"{k}={v}" for k, v in params.items()) in doc, params
