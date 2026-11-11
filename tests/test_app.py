"""Smoke test: the Streamlit app runs end to end on the committed real data, for every site."""
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
pytest.importorskip("streamlit.testing.v1")
if not any((ROOT / "data" / "series").glob("*.npz")):
    pytest.skip("no precomputed series", allow_module_level=True)

from streamlit.testing.v1 import AppTest  # noqa: E402

APP = str(ROOT / "app.py")


def _site_box(at):
    return next(s for s in at.selectbox if s.label == "Site")


def test_app_every_site_renders():
    at = AppTest.from_file(APP, default_timeout=180).run()
    assert not at.exception, at.exception
    options = _site_box(at).options
    assert len(options) >= 2
    for k, name in enumerate(options):
        at = AppTest.from_file(APP, default_timeout=180).run()
        _site_box(at).set_value(k).run()
        assert not at.exception, (name, at.exception)
        assert len(at.metric) == 5
        assert any("UTC" in m.value for m in at.markdown)           # time-cursor readout
        if name.startswith("↳ derived"):
            assert any(i.value.startswith("**Derived point.**") for i in at.info)


def test_sidebar_changes_recompute_the_scan():
    import json

    def heat(at):
        fig = json.loads(at.get("plotly_chart")[0].proto.spec)
        return fig["data"][0]

    at = AppTest.from_file(APP, default_timeout=180).run()
    base = heat(at)
    next(s for s in at.selectbox if s.label == "Start-date step").set_value(6).run()
    assert not at.exception, at.exception
    assert len(heat(at)["x"]) > 3 * len(base["x"])               # 6 h step -> ~4x more start dates
    at = AppTest.from_file(APP, default_timeout=180).run()
    next(s for s in at.slider if s.label == "Min. sunlit time").set_value(100).run()
    assert not at.exception, at.exception
    assert heat(at)["z"] != base["z"]                              # stricter requirement changes scores


def test_url_encodes_and_restores_the_scenario():
    at = AppTest.from_file(APP, default_timeout=180)
    at.query_params.update({"days": "7", "sun": "60", "step": "12", "site": "de_gerlache_rim",
                            "start": "2027-03-01T12:00"})
    at.run()
    assert not at.exception, at.exception
    assert next(s for s in at.slider if s.label == "Surface duration (days)").value == 7
    assert next(s for s in at.selectbox if s.label == "Start-date step").value == 12
    assert _site_box(at).value == next(i for i, o in enumerate(_site_box(at).options) if o.startswith("de Gerlache"))
    start = next(s for s in at.select_slider if s.label == "Start").value
    assert str(start).startswith("2027-03-01 12:00")
    qp = at.query_params
    assert qp["days"] == ["7"] or qp["days"] == "7"
    assert "de_gerlache_rim" in str(qp["site"]) and "2027-03-01T12:00" in str(qp["start"])

    # garbage in the URL falls back to defaults instead of crashing
    at = AppTest.from_file(APP, default_timeout=180)
    at.query_params.update({"days": "banana", "step": "7", "site": "nowhere", "start": "not-a-date"})
    at.run()
    assert not at.exception, at.exception
    assert next(s for s in at.slider if s.label == "Surface duration (days)").value == 14
