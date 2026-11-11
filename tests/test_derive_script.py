"""End-to-end: scripts/derive_best_points.py on a synthetic DEM, in a temporary data folder."""
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
import yaml

rasterio = pytest.importorskip("rasterio")
pyproj = pytest.importorskip("pyproj")
ROOT = Path(__file__).resolve().parent.parent
SITE = dict(id="shackleton_ridge", name="Ridge", lat=-89.4395, lon=-137.1934, source="test", verified=True)


def _pit_dem(path, lat, lon, half=12_000.0, res=40.0, depth=100.0, sigma=700.0):
    """Flat ground with a Gaussian pit centred on the site: the cited point is blinded on purpose."""
    from rasterio.transform import from_origin
    crs = pyproj.CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")
    geo = pyproj.CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
    sx, sy = pyproj.Transformer.from_crs(geo, crs, always_xy=True).transform(lon, lat)
    n = int(2 * half / res)
    x = sx - half + res * (np.arange(n) + 0.5)
    y = sy + half - res * (np.arange(n) + 0.5)
    X, Y = np.meshgrid(x, y)
    Z = -depth * np.exp(-((X - sx) ** 2 + (Y - sy) ** 2) / sigma ** 2)
    with rasterio.open(path, "w", driver="GTiff", height=n, width=n, count=1, dtype="float32", crs=crs,
                       transform=from_origin(sx - half, sy + half, res, res)) as d:
        d.write(Z.astype("float32"), 1)


@pytest.fixture
def data_dir(tmp_path):
    d = tmp_path / "data"
    (d / "series").mkdir(parents=True)
    (d / "sites.yaml").write_text(yaml.safe_dump({"sites": [SITE]}))
    shutil.copy(ROOT / "data" / "series" / "shackleton_ridge.npz", d / "series")   # real DE440 sky series
    return d


def _run(dem, data_dir):
    return subprocess.run([sys.executable, str(ROOT / "scripts" / "derive_best_points.py"), str(dem),
                           "--data", str(data_dir), "--spacing", "250", "--max-km", "8"],
                          capture_output=True, text=True, timeout=300)


def test_derive_moves_out_of_the_pit_and_is_idempotent(tmp_path, data_dir):
    dem = tmp_path / "pit.tif"
    _pit_dem(dem, SITE["lat"], SITE["lon"])
    r = _run(dem, data_dir)
    assert r.returncode == 0, r.stderr
    derived = yaml.safe_load((data_dir / "derived_sites.yaml").read_text())["sites"]
    assert len(derived) == 1
    d = derived[0]
    assert d["derived_from"] == "shackleton_ridge" and 0 < d["distance_m"] <= 1000 and d["slope_deg"] <= 10
    assert (data_dir / "series" / "shackleton_ridge_derived.npz").exists()

    sys.path.insert(0, str(ROOT))
    from lunanav.horizon import load_profiles
    from lunanav.series import load_series
    hz = load_profiles(data_dir / "horizons.json")
    assert "shackleton_ridge_derived" in hz and max(hz["shackleton_ridge_derived"].elevations_deg) < 8
    v, _, terrain = load_series("shackleton_ridge_derived", data_dir / "series")
    assert "derived point" in terrain and len(v.times_utc) > 1000

    r2 = _run(dem, data_dir)                                    # second run replaces, never duplicates
    assert r2.returncode == 0, r2.stderr
    assert len(yaml.safe_load((data_dir / "derived_sites.yaml").read_text())["sites"]) == 1
    assert (ROOT / "data" / "derived_sites.yaml").read_text().count("shackleton_ridge_derived") == 0  # repo untouched
