"""Offline: centre point of each NASA Artemis III candidate region -> data/sites.yaml.

usage: python scripts/artemis_regions.py path/to/unzipped_usgs_release/ [--dry-run]

Source: McClernan, M.T. (2024), "Down-selected Artemis III candidate landing site
navigational grids", USGS Astrogeology data release, https://doi.org/10.5066/P1MEQ6UK
(1 km / 100 m / 10 m grid shapefiles for the nine regions NASA named in Oct 2024).

NASA publishes the regions as ~15 km areas, not points. This script takes the
area-weighted centroid of each region's 1 km grid (in the shapefile's own polar
projection, read from its .prj) and converts it to lat/lon. The result is a
*region centre*, not a landing point; run scripts/derive_best_points.py afterwards
to find a landable spot near it. Regions that already have a published point in
sites.yaml (Malapert Massif, Mons Mouton) are skipped unless --all is given.

Needs: pyshp, pyproj.
"""
import argparse
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

REGIONS = {   # USGS file-name token -> (site id, display name)
    "Peak_Near_Cabeus_B": ("artemis_peak_near_cabeus_b", "Peak near Cabeus B"),
    "Haworth": ("artemis_haworth", "Haworth"),
    "Malapert_Massif": ("artemis_malapert_massif", "Malapert Massif"),
    "Mons_Mouton_Plateau": ("artemis_mons_mouton_plateau", "Mons Mouton Plateau"),
    "Mons_Mouton": ("artemis_mons_mouton", "Mons Mouton"),
    "Nobile_Rim_1": ("artemis_nobile_rim_1", "Nobile Rim 1"),
    "Nobile_Rim_2": ("artemis_nobile_rim_2", "Nobile Rim 2"),
    "de_Gerlache_Rim_2": ("artemis_de_gerlache_rim_2", "de Gerlache Rim 2"),
    "Slater_Plain": ("artemis_slater_plain", "Slater Plain"),
}
HAS_PUBLISHED_POINT = {"Malapert_Massif", "Mons_Mouton"}
SOURCE = ("McClernan 2024, USGS data release 'Down-selected Artemis III candidate landing site "
          "navigational grids': https://doi.org/10.5066/P1MEQ6UK")


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def region_of(path: Path):
    """Longest matching region token wins (so Mons_Mouton_Plateau is not Mons_Mouton)."""
    n = _norm(path.stem)
    hits = [k for k in REGIONS if _norm(k) in n]
    return max(hits, key=len) if hits else None


def is_1km(path: Path):
    return bool(re.search(r"(?<![0-9])1_?km|1000_?m", path.stem, re.I))


def ring_area_centroid(xy):
    """Signed area and centroid of one closed ring (shoelace)."""
    x, y = np.asarray(xy, float).T
    x1, y1 = np.roll(x, -1), np.roll(y, -1)
    cross = x * y1 - x1 * y
    a = cross.sum() / 2.0
    if a == 0:
        return 0.0, x.mean(), y.mean()
    return a, ((x + x1) * cross).sum() / (6 * a), ((y + y1) * cross).sum() / (6 * a)


def shapes_centroid(paths):
    """Area-weighted centroid (projected units) of all polygon parts in the given shapefiles."""
    import shapefile
    A = Cx = Cy = 0.0
    for p in paths:
        with shapefile.Reader(str(p)) as r:
            for shp in r.shapes():
                parts = list(shp.parts) + [len(shp.points)]
                for i in range(len(parts) - 1):
                    a, cx, cy = ring_area_centroid(shp.points[parts[i]:parts[i + 1]])
                    A, Cx, Cy = A + a, Cx + a * cx, Cy + a * cy   # holes have opposite sign
    if A == 0:
        raise ValueError(f"no polygon area in {[p.name for p in paths]}")
    return Cx / A, Cy / A, abs(A)


def to_lonlat(x, y, prj_path: Path):
    from pyproj import CRS, Transformer
    crs = CRS.from_wkt(prj_path.read_text())
    geo = CRS.from_proj4("+proj=longlat +R=1737400 +no_defs +type=crs")
    lon, lat = Transformer.from_crs(crs, geo, always_xy=True).transform(x, y)
    return float(lat), (float(lon) + 180.0) % 360.0 - 180.0


def find_regions(folder: Path):
    groups = {}
    for p in sorted(folder.rglob("*.shp")):
        reg = region_of(p)
        if reg:
            groups.setdefault(reg, []).append(p)
    out = {}
    for reg, files in groups.items():
        km = [p for p in files if is_1km(p)]
        out[reg] = km or files
    return out


def yaml_entry(reg, lat, lon, area_km2, files, indent="  "):
    """One sites.yaml list item; `indent` matches the file's existing "- id:" lines."""
    sid, name = REGIONS[reg]
    i = indent
    return (f"{i}- id: {sid}\n"
            f"{i}  name: {name} (Artemis III region centre)\n"
            f"{i}  lat: {lat:.4f}\n"
            f"{i}  lon: {lon:.4f}\n"
            f"{i}  category: artemis_region\n"
            f"{i}  note: >-\n"
            f"{i}    Artemis III candidate region (NASA, Oct 2024). Point = area-weighted centre of the USGS 1 km\n"
            f"{i}    navigation grid ({area_km2:.0f} km2; {', '.join(p.name for p in files)}), computed by\n"
            f"{i}    scripts/artemis_regions.py. A region centre, not a landing point: see the derived point.\n"
            f"{i}  source: \"{SOURCE}\"\n"
            f"{i}  verified: true\n")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", help="unzipped USGS release (searched recursively for .shp)")
    ap.add_argument("--all", action="store_true", help="also add regions that already have a published point")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--sites", default=str(ROOT / "data" / "sites.yaml"))
    a = ap.parse_args(argv)

    sites_path = Path(a.sites)
    text = sites_path.read_text()
    m = re.search(r"^([ \t]*)- id:", text, re.M)
    indent = m.group(1) if m else "  "
    found = find_regions(Path(a.folder))
    missing = sorted(set(REGIONS) - set(found))
    if missing:
        print("not found in folder:", ", ".join(missing))
    added = []
    for reg, files in sorted(found.items()):
        if reg in HAS_PUBLISHED_POINT and not a.all:
            print(f"{reg:22s} skipped (published point already in sites.yaml)")
            continue
        sid = REGIONS[reg][0]
        prj = files[0].with_suffix(".prj")
        if not prj.exists():
            print(f"{reg:22s} skipped: {prj.name} missing (projection unknown)")
            continue
        x, y, area = shapes_centroid(files)
        lat, lon = to_lonlat(x, y, prj)
        area_km2 = area / 1e6 if area > 1e4 else area     # metres or km in the projection
        print(f"{reg:22s} centre {lat:9.4f} {lon:9.4f}  area {area_km2:6.0f} km2  from {len(files)} file(s)")
        if re.search(rf"^\s*- id: {sid}\s*$", text, re.M):
            print(f"{'':22s} already in sites.yaml, not added again")
            continue
        added.append(yaml_entry(reg, lat, lon, area_km2, files, indent))
    if added and not a.dry_run:
        sites_path.write_text(text.rstrip("\n") + "\n\n" + "\n".join(added))
        print(f"added {len(added)} region centre(s) to {sites_path}")
        print("next: build_horizons.py, precompute.py, derive_best_points.py (see README)")
    return added


if __name__ == "__main__":
    main()
