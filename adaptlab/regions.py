"""NASA Artemis III candidate regions from the USGS navigation grids.

Source: McClernan, M.T. (2024), "Down-selected Artemis III candidate landing site
navigational grids", USGS Astrogeology data release, https://doi.org/10.5066/P1MEQ6UK

Each region's 1 km grid is a set of axis-aligned 1 km squares in a south-polar
stereographic projection (its .prj). A point is inside the region when the grid
cell that contains it is one of the region's cells, so membership is an exact
lookup, no polygon maths.

Needs pyshp and pyproj (offline extras); the app never imports this module.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import numpy as np

REGIONS = {   # USGS file-name token -> (site id of the region centre, display name)
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
# regions represented in sites.yaml by a published point inside them instead of a computed centre.
# (The IM-2 "Athena" point, our mons_mouton site, lies inside the Mons Mouton PLATEAU grid, 20 km from
# the Mons Mouton region's centre, so it does not stand for the Mons Mouton region.)
HAS_PUBLISHED_POINT = {"Malapert_Massif": "malapert_massif"}
SOURCE = ("McClernan 2024, USGS data release 'Down-selected Artemis III candidate landing site "
          "navigational grids': https://doi.org/10.5066/P1MEQ6UK")
GEO = "+proj=longlat +R=1737400 +no_defs +type=crs"


def parent_site_id(region: str) -> str:
    """The sites.yaml entry that stands for this region (published point if there is one)."""
    return HAS_PUBLISHED_POINT.get(region) or REGIONS[region][0]


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def region_of(path: Path):
    """Longest matching region token wins (so Mons_Mouton_Plateau is not Mons_Mouton)."""
    n = _norm(Path(path).stem)
    hits = [k for k in REGIONS if _norm(k) in n]
    return max(hits, key=len) if hits else None


def is_1km(path: Path):
    return bool(re.search(r"(?<![0-9])1_?km|1000_?m", Path(path).stem, re.I))


def find_regions(folder: Path) -> dict[str, list[Path]]:
    """region token -> shapefiles (the 1 km grid when present) found anywhere under `folder`."""
    groups = {}
    for p in sorted(Path(folder).rglob("*.shp")):
        reg = region_of(p)
        if reg:
            groups.setdefault(reg, []).append(p)
    return {reg: ([p for p in files if is_1km(p)] or files) for reg, files in groups.items()}


@dataclass
class RegionGrid:
    name: str
    cell_m: float
    x0: float
    y0: float
    keys: frozenset            # (i, j) indices of the region's cells
    wkt: str

    @classmethod
    def from_shapefiles(cls, name, paths) -> "RegionGrid":
        import shapefile
        rects = []
        for p in paths:
            with shapefile.Reader(str(p)) as r:
                for shp in r.shapes():
                    pts = np.asarray(shp.points, float)
                    xs, ys = np.unique(pts[:, 0]), np.unique(pts[:, 1])
                    if len(xs) != 2 or len(ys) != 2:
                        raise ValueError(f"{Path(p).name}: cell is not an axis-aligned rectangle")
                    rects.append((xs[0], ys[0], xs[1], ys[1]))
        rects = np.asarray(rects)
        w, h = rects[:, 2] - rects[:, 0], rects[:, 3] - rects[:, 1]
        cell = float(np.median(w))
        if not (np.allclose(w, cell, rtol=1e-6) and np.allclose(h, cell, rtol=1e-6)):
            raise ValueError(f"{name}: grid cells are not equal squares")
        x0, y0 = float(rects[:, 0].min()), float(rects[:, 1].min())
        keys = frozenset(zip(np.rint((rects[:, 0] - x0) / cell).astype(int).tolist(),
                             np.rint((rects[:, 1] - y0) / cell).astype(int).tolist()))
        prj = Path(paths[0]).with_suffix(".prj")
        if not prj.exists():
            raise ValueError(f"{prj.name} missing: projection unknown")
        return cls(name, cell, x0, y0, keys, prj.read_text())

    @property
    def area_km2(self) -> float:
        return len(self.keys) * self.cell_m ** 2 / 1e6

    def contains(self, x, y):
        i = np.floor((np.asarray(x, float) - self.x0) / self.cell_m).astype(int)
        j = np.floor((np.asarray(y, float) - self.y0) / self.cell_m).astype(int)
        return np.array([(a, b) in self.keys for a, b in zip(i.ravel(), j.ravel())]).reshape(i.shape)

    def grid_points(self, spacing_m: float):
        """Projected (x, y) of a regular grid at `spacing_m` clipped to the region."""
        ii = np.array([k[0] for k in self.keys]); jj = np.array([k[1] for k in self.keys])  # noqa: E702
        xs = np.arange(self.x0 + spacing_m / 2, self.x0 + (ii.max() + 1) * self.cell_m, spacing_m)
        ys = np.arange(self.y0 + spacing_m / 2, self.y0 + (jj.max() + 1) * self.cell_m, spacing_m)
        X, Y = np.meshgrid(xs, ys)
        keep = self.contains(X, Y)
        return X[keep], Y[keep]

    def boundary_segments(self):
        """Outline of the region: every cell edge that belongs to exactly one cell, merged into
        straight runs. Returns an (n, 2, 2) array of projected ((x0, y0), (x1, y1)) segments."""
        h, v = set(), set()          # horizontal edge (i, j) = from (i, j) to (i+1, j); vertical (i, j) to (i, j+1)
        for i, j in self.keys:
            for e, bucket in (((i, j), h), ((i, j + 1), h), ((i, j), v), ((i + 1, j), v)):
                bucket.symmetric_difference_update({e})
        segs = []
        for edges, horiz in ((h, True), (v, False)):
            # merge consecutive unit edges on the same line
            lines = {}
            for i, j in edges:
                lines.setdefault(j if horiz else i, []).append(i if horiz else j)
            for fixed, run in lines.items():
                run = sorted(run)
                start = prev = run[0]
                for k in run[1:] + [None]:
                    if k is not None and k == prev + 1:
                        prev = k
                        continue
                    a, b = (start, prev + 1)
                    p0 = (a, fixed) if horiz else (fixed, a)
                    p1 = (b, fixed) if horiz else (fixed, b)
                    segs.append([[self.x0 + p0[0] * self.cell_m, self.y0 + p0[1] * self.cell_m],
                                 [self.x0 + p1[0] * self.cell_m, self.y0 + p1[1] * self.cell_m]])
                    if k is not None:
                        start = prev = k
        return np.asarray(segs, float)

    def _tf(self, inverse: bool):
        from pyproj import CRS, Transformer
        a, b = CRS.from_wkt(self.wkt), CRS.from_proj4(GEO)
        return Transformer.from_crs(a, b, always_xy=True) if inverse else Transformer.from_crs(b, a, always_xy=True)

    def to_latlon(self, x, y):
        lon, lat = self._tf(True).transform(np.asarray(x, float), np.asarray(y, float))
        return np.asarray(lat), (np.asarray(lon) + 180.0) % 360.0 - 180.0

    def to_xy(self, lat, lon):
        x, y = self._tf(False).transform(np.asarray(lon, float), np.asarray(lat, float))
        return np.asarray(x), np.asarray(y)
