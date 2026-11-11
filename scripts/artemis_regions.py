"""Offline: centre point of each NASA Artemis III candidate region -> data/sites.yaml.

usage: python scripts/artemis_regions.py path/to/unzipped_usgs_release/ [--dry-run]

Source: McClernan, M.T. (2024), "Down-selected Artemis III candidate landing site
navigational grids", USGS Astrogeology data release, https://doi.org/10.5066/P1MEQ6UK
(1 km / 100 m / 10 m grid shapefiles for the nine regions NASA named in Oct 2024).

NASA publishes the regions as ~15 km areas, not points. This script takes the
area-weighted centroid of each region's 1 km grid (in the shapefile's own polar
projection, read from its .prj) and converts it to lat/lon. The result is a
*region centre*, not a landing point; run scripts/derive_best_points.py afterwards
to find a landable spot near it. Regions that already have a published point inside
them in sites.yaml (Malapert Massif) are skipped unless --all is given.

Needs: pyshp, pyproj.
"""
import argparse
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunanav.regions import (HAS_PUBLISHED_POINT, REGIONS, SOURCE, RegionGrid, find_regions,  # noqa: E402,F401
                             is_1km, parent_site_id, region_of)


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


def write_outlines(found, out_path: Path, max_piece_m=2000.0):
    """data/artemis_regions.json: each region's exact outline (from its 1 km grid) in lat/lon, for the app map.
    Long edges are split into <= max_piece_m pieces so they stay straight-enough on any polar map."""
    import json
    out = {"source": SOURCE, "note": "Outline = boundary of the region's USGS 1 km grid cells "
                                     "(scripts/artemis_regions.py --outlines).", "regions": {}}
    for reg, files in sorted(found.items()):
        g = RegionGrid.from_shapefiles(reg, files)
        pieces = []
        for (x0, y0), (x1, y1) in g.boundary_segments():
            n = max(1, int(np.ceil(np.hypot(x1 - x0, y1 - y0) / max_piece_m)))
            t = np.linspace(0, 1, n + 1)
            la, lo = g.to_latlon(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
            pieces.append([[round(float(a), 5), round(float(b), 5)] for a, b in zip(la, lo)])
        out["regions"][reg] = {"name": REGIONS[reg][1], "site": parent_site_id(reg),
                               "area_km2": round(g.area_km2), "lines": pieces}
    out_path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote outlines of {len(found)} region(s) to {out_path}")


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", help="unzipped USGS release (searched recursively for .shp)")
    ap.add_argument("--all", action="store_true", help="also add regions that already have a published point")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--outlines", action="store_true", help="also write data/artemis_regions.json (map outlines)")
    ap.add_argument("--sites", default=str(ROOT / "data" / "sites.yaml"))
    a = ap.parse_args(argv)

    sites_path = Path(a.sites)
    text = sites_path.read_text()
    m = re.search(r"^([ \t]*)- id:", text, re.M)
    indent = m.group(1) if m else "  "
    found = find_regions(Path(a.folder))
    if a.outlines and not a.dry_run:
        write_outlines(found, sites_path.with_name("artemis_regions.json"))
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
