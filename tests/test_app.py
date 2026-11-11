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
