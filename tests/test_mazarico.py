"""scripts/mazarico_compare.py on synthetic maps encoded like NASA's (int16 + scale tag, percent)."""
import importlib.util
import json
import shutil
from pathlib import Path

import numpy as np
import pytest
import yaml

rasterio = pytest.importorskip("rasterio")
pyproj = pytest.importorskip("pyproj")
ROOT = Path(__file__).resolve().parent.parent
SITE = dict(id="shackleton_ridge", name="Ridge", lat=-89.4395, lon=-137.1934, source="t", verified=True)
CRS = pyproj.CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")


def _load():
    spec = importlib.util.spec_from_file_location("mz", ROOT / "scripts" / "mazarico_compare.py")
    mz = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mz)
    return mz


def _maps(tmp, psr_dark=True, res=120.0, half=40_000.0):
    from rasterio.transform import from_origin
    geo = pyproj.CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
    sx, sy = pyproj.Transformer.from_crs(geo, CRS, always_xy=True).transform(SITE["lon"], SITE["lat"])
    n = int(2 * half / res)
    X, Y = np.meshgrid(sx - half + res * (np.arange(n) + .5), sy + half - res * (np.arange(n) + .5))
    psr = (np.hypot(X - sx, Y - (sy + 3000)) <= 1000).astype("int16")         # 1 km disk, 3 km "up"
    sun_pct = np.where(psr == 1, 0.0 if psr_dark else 40.0, 60.0)              # percent
    t = from_origin(sx - half, sy + half, res, res)

    def write(name, arr, dtype, scale=1.0):
        with rasterio.open(tmp / name, "w", driver="GTiff", height=n, width=n, count=1, dtype=dtype,
                           crs=CRS, transform=t) as d:
            d.write(arr.astype(dtype), 1)
            d.scales, d.offsets = (scale,), (0.0,)
        return tmp / name

    return (write("sun.tif", np.round(sun_pct / 0.01), "int16", 0.01),     # stored x100, scale 0.01 -> percent
            write("earth.tif", np.full((n, n), 0.5), "float32"),             # a fraction map
            write("psr.tif", psr, "int16"))


@pytest.fixture
def data(tmp_path):
    d = tmp_path / "data"
    (d / "series").mkdir(parents=True)
    (d / "sites.yaml").write_text(yaml.safe_dump({"sites": [SITE]}))
    shutil.copy(ROOT / "data" / "series" / "shackleton_ridge.npz", d / "series")
    return d


def test_compare_reads_units_finds_psr_and_measures_distance(tmp_path, data):
    sun, earth, psr = _maps(tmp_path)
    out = _load().main(["--sun", str(sun), "--earth", str(earth), "--psr", str(psr), "--data", str(data)])
    assert out["psr_code"] == 1
    r = out["sites"]["shackleton_ridge"]
    assert r["mazarico_sun"] == pytest.approx(0.60, abs=1e-3)       # percent map read as percent
    assert r["mazarico_earth"] == pytest.approx(0.50, abs=1e-3)     # fraction map read as fraction
    assert r["psr_nearest_km"] == pytest.approx(2.0, abs=0.15)      # 3 km to the centre - 1 km radius
    assert r["psr_area_within_5km_km2"] == pytest.approx(np.pi, rel=0.08)
    assert 0 < r["lunanav_sun_mean"] <= 1
    assert json.loads((data / "mazarico.json").read_text())["sites"]["shackleton_ridge"] == r


def test_compare_refuses_to_guess_the_psr_code(tmp_path, data):
    sun, earth, psr = _maps(tmp_path, psr_dark=False)               # no code has ~0 % illumination
    with pytest.raises(SystemExit):
        _load().main(["--sun", str(sun), "--earth", str(earth), "--psr", str(psr), "--data", str(data)])
