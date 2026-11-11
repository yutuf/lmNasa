"""RegionGrid, distance_bearing and scripts/derive_region_best.py on synthetic data."""
import importlib.util
import shutil
from pathlib import Path

import numpy as np
import pytest
import yaml

from lunanav.geometry import destination, distance_bearing

shapefile = pytest.importorskip("shapefile")
pyproj = pytest.importorskip("pyproj")
ROOT = Path(__file__).resolve().parent.parent
LPS = pyproj.CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")
GEO = pyproj.CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
SITE = dict(id="artemis_haworth", name="Haworth (Artemis III region centre)", lat=-89.4395, lon=-137.1934,
            category="artemis_region", source="test", verified=True)


def _xy(lat, lon):
    return pyproj.Transformer.from_crs(GEO, LPS, always_xy=True).transform(lon, lat)


def _grid_shp(path, lat, lon, half_cells=4):
    """(2*half_cells)^2 axis-aligned 1 km cells around (lat, lon), USGS-style, with .prj."""
    x0, y0 = _xy(lat, lon)
    x0, y0 = np.floor(x0 / 1000) * 1000, np.floor(y0 / 1000) * 1000
    with shapefile.Writer(str(path), shapeType=shapefile.POLYGON) as w:
        w.field("id", "N")
        for k, (i, j) in enumerate((i, j) for i in range(-half_cells, half_cells) for j in range(-half_cells, half_cells)):
            x, y = x0 + i * 1000, y0 + j * 1000
            w.poly([[(x, y), (x, y + 1000), (x + 1000, y + 1000), (x + 1000, y), (x, y)]])
            w.record(k)
    path.with_suffix(".prj").write_text(LPS.to_wkt())


def test_distance_bearing_inverts_destination():
    rng = np.random.default_rng(0)
    la0, lo0 = rng.uniform(-89.9, -80, 40), rng.uniform(-180, 180, 40)
    az, d = rng.uniform(0, 360, 40), rng.uniform(1, 30_000, 40)
    dd, bb = distance_bearing(la0, lo0, *destination(la0, lo0, az, d))
    assert np.allclose(dd, d, atol=1e-6) and np.allclose((bb - az + 180) % 360 - 180, 0, atol=1e-8)


def test_region_grid_membership_and_points(tmp_path):
    from lunanav.regions import RegionGrid
    _grid_shp(tmp_path / "Haworth_1km.shp", -87.0, -20.0, half_cells=3)
    g = RegionGrid.from_shapefiles("Haworth", [tmp_path / "Haworth_1km.shp"])
    assert g.area_km2 == pytest.approx(36.0) and g.cell_m == pytest.approx(1000.0)
    x, y = g.grid_points(500.0)
    assert len(x) == 144 and g.contains(x, y).all()
    assert not g.contains(np.array([g.x0 - 1.0]), np.array([g.y0 + 10.0]))[0]
    la, lo = g.to_latlon(x[:3], y[:3])
    bx, by = g.to_xy(la, lo)
    assert np.allclose(bx, x[:3]) and np.allclose(by, y[:3])


def test_region_grid_rejects_non_square_cells(tmp_path):
    from lunanav.regions import RegionGrid
    p = tmp_path / "Haworth_1km.shp"
    with shapefile.Writer(str(p), shapeType=shapefile.POLYGON) as w:
        w.field("id", "N")
        w.poly([[(0, 0), (0, 1000), (2000, 1000), (2000, 0), (0, 0)]])
        w.record(0)
    p.with_suffix(".prj").write_text(LPS.to_wkt())
    with pytest.raises(ValueError):
        RegionGrid.from_shapefiles("Haworth", [p])


def _bowl_dem(path, lat, lon, half=14_000.0, res=40.0, depth=150.0, sigma=2500.0):
    """The site sits at the bottom of a wide bowl: the open ground is ~3 km away, beyond a 1 km search."""
    from rasterio.transform import from_origin
    import rasterio
    sx, sy = _xy(lat, lon)
    n = int(2 * half / res)
    X, Y = np.meshgrid(sx - half + res * (np.arange(n) + .5), sy + half - res * (np.arange(n) + .5))
    Z = -depth * np.exp(-((X - sx) ** 2 + (Y - sy) ** 2) / sigma ** 2)
    with rasterio.open(path, "w", driver="GTiff", height=n, width=n, count=1, dtype="float32", crs=LPS,
                       transform=from_origin(sx - half, sy + half, res, res)) as d:
        d.write(Z.astype("float32"), 1)


def test_region_search_leaves_the_bowl_and_keeps_1km_entry(tmp_path):
    pytest.importorskip("rasterio")
    spec = importlib.util.spec_from_file_location("drb", ROOT / "scripts" / "derive_region_best.py")
    drb = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(drb)

    data = tmp_path / "data"
    (data / "series").mkdir(parents=True)
    (data / "sites.yaml").write_text(yaml.safe_dump({"sites": [SITE]}))
    shutil.copy(ROOT / "data" / "series" / "shackleton_ridge.npz", data / "series" / "artemis_haworth.npz")
    keep = dict(id="artemis_haworth_derived", name="1 km point", lat=-89.44, lon=-137.19, category="derived",
                derived_from="artemis_haworth", search="1 km", distance_m=100, bearing_deg=0, slope_deg=1,
                cited_slope_deg=1, note="", source="", verified=False)
    (data / "derived_sites.yaml").write_text(yaml.safe_dump({"sites": [keep]}))
    grids = tmp_path / "grids"
    grids.mkdir()
    _grid_shp(grids / "Haworth_PolarLGRS_ACC_1km_S_Grid.shp", SITE["lat"], SITE["lon"], half_cells=5)
    dem = tmp_path / "bowl.tif"
    _bowl_dem(dem, SITE["lat"], SITE["lon"])

    args = [str(dem), str(grids), "--data", str(data), "--max-candidates", "60", "--top", "2",
            "--refine-spacing", "150", "--refine-radius", "300", "--max-km", "8"]
    assert drb.main(args) == ["artemis_haworth_region_best"]
    entries = {e["id"]: e for e in yaml.safe_load((data / "derived_sites.yaml").read_text())["sites"]}
    assert entries["artemis_haworth_derived"] == keep                       # 1 km result untouched
    rb = entries["artemis_haworth_region_best"]
    assert rb["search"] == "region" and rb["distance_m"] > 1500 and rb["slope_deg"] <= 10

    from lunanav.regions import RegionGrid
    g = RegionGrid.from_shapefiles("Haworth", [grids / "Haworth_PolarLGRS_ACC_1km_S_Grid.shp"])
    assert g.contains(*g.to_xy(rb["lat"], rb["lon"]))                       # inside the region
    from lunanav.series import load_series
    from lunanav.sites import load_sites
    v = load_series("artemis_haworth_region_best", data / "series")[0]
    site_v = load_series("artemis_haworth", data / "series")[0]
    both = lambda vv: ((vv.sun_fraction >= .5) & vv.earth_visible).mean()  # noqa: E731
    assert v is not None and "region search" in load_series("artemis_haworth_region_best", data / "series")[2]
    assert any(s.id == "artemis_haworth_region_best" and s.search == "region" for s in load_sites(data / "sites.yaml"))
    assert len(v.times_utc) == len(site_v.times_utc)
    import re
    got, at_site = map(float, re.search(r"both in view, ([\d.]+)% vs ([\d.]+)%", rb["note"]).groups())
    assert at_site < 5 and got > at_site + 15                                   # the bowl blinds the site
    assert both(v) * 100 == pytest.approx(got, abs=0.06)                        # note matches the series

    assert drb.main(args) == ["artemis_haworth_region_best"]                 # rerun replaces, never duplicates
    ids = [e["id"] for e in yaml.safe_load((data / "derived_sites.yaml").read_text())["sites"]]
    assert sorted(ids) == ["artemis_haworth_derived", "artemis_haworth_region_best"]
