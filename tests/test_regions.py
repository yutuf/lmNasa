"""scripts/artemis_regions.py on synthetic USGS-like shapefiles."""
import importlib.util
from pathlib import Path

import numpy as np
import pytest

shapefile = pytest.importorskip("shapefile")
pyproj = pytest.importorskip("pyproj")
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("artemis_regions", ROOT / "scripts" / "artemis_regions.py")
ar = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ar)

LPS = pyproj.CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")


def _grid(path: Path, lat, lon, half_km=7.5, cell_km=1.0):
    geo = pyproj.CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
    x0, y0 = pyproj.Transformer.from_crs(geo, LPS, always_xy=True).transform(lon, lat)
    with shapefile.Writer(str(path), shapeType=shapefile.POLYGON) as w:
        w.field("id", "N")
        k = 0
        for i in np.arange(-half_km, half_km, cell_km):
            for j in np.arange(-half_km, half_km, cell_km):
                x, y = x0 + i * 1000, y0 + j * 1000
                d = cell_km * 1000
                w.poly([[(x, y), (x, y + d), (x + d, y + d), (x + d, y), (x, y)]])   # clockwise outer ring
                w.record(k)
                k += 1
    path.with_suffix(".prj").write_text(LPS.to_wkt())


def test_region_name_matching():
    assert ar.region_of(Path("Mons_Mouton_Plateau_1km_UL.shp")) == "Mons_Mouton_Plateau"
    assert ar.region_of(Path("Mons_Mouton_1km.shp")) == "Mons_Mouton"
    assert ar.region_of(Path("de_Gerlache_Rim_2_100m.shp")) == "de_Gerlache_Rim_2"
    assert ar.is_1km(Path("Haworth_1km")) and not ar.is_1km(Path("Haworth_10m")) and not ar.is_1km(Path("x_11km"))


def test_centroid_round_trip_and_append(tmp_path):
    src = tmp_path / "usgs"
    src.mkdir()
    _grid(src / "Haworth_1km.shp", -87.45, -4.0)
    _grid(src / "Haworth_10m.shp", -80.0, 100.0)           # must be ignored: 1 km grid preferred
    # Mons Mouton Plateau in four quadrant files, centre of the union = the point
    for q, (dx, dy) in {"UL": (-1, 1), "UR": (1, 1), "LL": (-1, -1), "LR": (1, -1)}.items():
        geo = pyproj.CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
        x0, y0 = pyproj.Transformer.from_crs(geo, LPS, always_xy=True).transform(30.0, -85.5)
        lon, lat = pyproj.Transformer.from_crs(LPS, geo, always_xy=True).transform(x0 + dx * 3000, y0 + dy * 3000)
        _grid(src / f"Mons_Mouton_Plateau_1km_{q}.shp", lat, lon, half_km=3.0)
    _grid(src / "Malapert_Massif_1km.shp", -86.0, 0.0)      # has a published point -> skipped

    # start from the repo's published points only, so the test does not depend on which
    # region centres have already been added to the live data/sites.yaml
    import yaml
    live = yaml.safe_load((ROOT / "data" / "sites.yaml").read_text())["sites"]
    sites = tmp_path / "sites.yaml"
    sites.write_text(yaml.safe_dump({"sites": [x for x in live if x.get("category") != "artemis_region"]},
                                    sort_keys=False, allow_unicode=True))
    added = ar.main([str(src), "--sites", str(sites)])
    assert len(added) == 2
    from lunanav.sites import load_sites
    got = {s.id: s for s in load_sites(sites, include_derived=False)}
    h, m = got["artemis_haworth"], got["artemis_mons_mouton_plateau"]
    assert h.lat == pytest.approx(-87.45, abs=1e-3) and h.lon == pytest.approx(-4.0, abs=0.05)
    assert m.lat == pytest.approx(-85.5, abs=1e-3) and m.lon == pytest.approx(30.0, abs=0.05)
    assert "artemis_malapert_massif" not in got and h.verified and h.category == "artemis_region"
    assert ar.main([str(src), "--sites", str(sites)]) == []  # idempotent
