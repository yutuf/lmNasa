"""Offline: compare LunaNav with NASA's independent polar illumination maps, and measure
the distance from every site to the nearest permanently shadowed region (PSR).

usage: python scripts/mazarico_compare.py --sun AVGVISIB_75S_120M_201608.TIF \\
            --earth AVGVISIB_75S_120M_201608_EARTH.TIF --psr LPSR_75S_120M_201608.TIF [--radius-km 25]

Source of the maps (NASA GSFC PGDA product 69, https://pgda.gsfc.nasa.gov/products/69):
Mazarico, E., et al. (2011), Illumination conditions of the lunar polar regions using LOLA
topography, Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030.
Averages over hourly steps spanning 18.6 years; Earth counts as visible if any part of its
disc shows (LunaNav: Earth's centre); no observer height stated (LunaNav: 2 m mast).

Nothing about the encoding is assumed blindly:
  * GeoTIFF scale/offset tags are applied; the unit (fraction or percent) is decided once per map from
    the largest value around the sites (> 1.5 means percent), never per pixel;
  * the PSR code is the value whose pixels have ~0 average solar illumination in the
    --sun map (checked, and the script stops if no code qualifies).
Writes data/mazarico.json, which the app shows next to each site.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunanav.series import load_series  # noqa: E402
from lunanav.sites import load_sites  # noqa: E402

SOURCE = ("Mazarico et al. 2011, Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030; "
          "NASA GSFC PGDA product 69 (https://pgda.gsfc.nasa.gov/products/69)")
GEO = "+proj=longlat +R=1737400 +no_defs +type=crs"


class Raster:
    def __init__(self, path):
        import rasterio
        from pyproj import CRS, Transformer
        self.src = rasterio.open(path)
        self.name = Path(path).name
        self.scale = float(self.src.scales[0] or 1.0)
        self.offset = float(self.src.offsets[0] or 0.0)
        self.nodata = self.src.nodata
        self.to_xy = Transformer.from_crs(CRS.from_proj4(GEO), self.src.crs, always_xy=True)
        self.pix = abs(self.src.transform.a)
        self.div = 1.0                      # set by calibrate(): 100 for a percent map

    def calibrate(self, samples, half_m=10_000):
        top = max(float(np.nanmax(self.window(lat, lon, half_m)[1])) for lat, lon in samples)
        self.div = 100.0 if top > 1.5 else 1.0
        print(f"{self.name}: largest value near the sites {top:g} -> read as {'percent' if self.div == 100 else 'fraction'}")

    def frac(self, v):
        return v / self.div

    def window(self, lat, lon, half_m):
        """Values (scaled, NaN for nodata) of a square window around a site + pixel-centre coordinates."""
        from rasterio.windows import Window
        x, y = self.to_xy.transform(lon, lat)
        row, col = self.src.index(x, y)
        h = int(np.ceil(half_m / self.pix))
        r0, c0 = max(row - h, 0), max(col - h, 0)
        r1, c1 = min(row + h + 1, self.src.height), min(col + h + 1, self.src.width)
        if r0 >= r1 or c0 >= c1:
            raise ValueError(f"{self.name}: site outside the map")
        raw = self.src.read(1, window=Window(c0, r0, c1 - c0, r1 - r0))
        val = raw.astype(float) * self.scale + self.offset
        if self.nodata is not None:
            val[raw == self.nodata] = np.nan
        rows, cols = np.mgrid[r0:r1, c0:c1]
        xs, ys = self.src.xy(rows.ravel(), cols.ravel())
        return raw, val, np.asarray(xs).reshape(raw.shape), np.asarray(ys).reshape(raw.shape), (x, y)

    def covers(self, lat, lon) -> bool:
        """True when the site falls on a valid (non-nodata) pixel of this map."""
        x, y = self.to_xy.transform(lon, lat)
        row, col = self.src.index(x, y)
        if not (0 <= row < self.src.height and 0 <= col < self.src.width):
            return False
        from rasterio.windows import Window
        raw = self.src.read(1, window=Window(col, row, 1, 1))[0, 0]
        return self.nodata is None or raw != self.nodata

    def at(self, lat, lon):
        _, val, xs, ys, (x, y) = self.window(lat, lon, self.pix)
        k = np.nanargmin((xs - x) ** 2 + (ys - y) ** 2)
        return float(val.ravel()[k])


def psr_code(psr: Raster, sun: Raster, samples):
    """The PSR value whose pixels have ~zero mean solar illumination (checked on site windows)."""
    stats = {}
    for lat, lon in samples:
        raw_p, _, xs, ys, _ = psr.window(lat, lon, 10_000)
        for code in np.unique(raw_p):
            m = raw_p == code
            sun_vals = [sun.at(*_xy_to_latlon(psr, x, y)) for x, y in zip(xs[m][::max(1, m.sum() // 40)],
                                                                         ys[m][::max(1, m.sum() // 40)])]
            s = stats.setdefault(int(code), [0, []])
            s[0] += int(m.sum())
            s[1] += sun_vals
    table = {c: (n, float(np.nanmean([sun.frac(v) for v in sv])) if sv else np.nan) for c, (n, sv) in stats.items()}
    print("PSR map codes (pixels in sampled windows, mean solar illumination there):")
    for c, (n, m) in sorted(table.items()):
        print(f"   value {c:>6}: {n:8d} px   mean illumination {m:6.3f}")
    dark = [c for c, (n, m) in table.items() if m < 0.01 and n > 0]
    lit = [c for c, (n, m) in table.items() if m >= 0.01]
    if len(dark) != 1 or not lit:
        raise SystemExit("could not identify the PSR code unambiguously; send this output instead of guessing")
    print(f"-> PSR code = {dark[0]} (the only code with ~0 % mean illumination)")
    return dark[0]


def _xy_to_latlon(r: Raster, x, y):
    from pyproj import CRS, Transformer
    t = getattr(r, "_inv", None) or Transformer.from_crs(r.src.crs, CRS.from_proj4(GEO), always_xy=True)
    r._inv = t
    lon, lat = t.transform(x, y)
    return float(lat), float(lon)


def psr_metrics(psr: Raster, code, lat, lon, radius_m):
    raw, _, xs, ys, (x, y) = psr.window(lat, lon, radius_m)
    m = raw == code
    if not m.any():
        return None, 0.0
    d = np.hypot(xs[m] - x, ys[m] - y)
    area5 = float((d <= 5000).sum() * psr.pix ** 2 / 1e6)
    return float(d.min() / 1000.0), area5


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--sun", required=True, help="AVGVISIB_..._201608.TIF (average solar illumination)")
    ap.add_argument("--earth", required=True, help="AVGVISIB_..._201608_EARTH.TIF (average Earth visibility)")
    ap.add_argument("--psr", required=True, help="LPSR_..._201608.TIF (permanent shadow)")
    ap.add_argument("--radius-km", type=float, default=25.0, help="search radius for the nearest PSR")
    ap.add_argument("--data", default=str(ROOT / "data"))
    ap.add_argument("--out", help="output JSON (default: <data>/mazarico.json)")
    a = ap.parse_args(argv)
    data = Path(a.data)
    out_path = Path(a.out) if a.out else data / "mazarico.json"

    sun, earth, psr = Raster(a.sun), Raster(a.earth), Raster(a.psr)
    for r in (sun, earth, psr):
        print(f"{r.name}: {r.src.width}x{r.src.height} px, {r.pix:.0f} m/px, dtype {r.src.dtypes[0]}, "
              f"scale {r.scale}, offset {r.offset}, nodata {r.nodata}")
    sites = [s for s in load_sites(data / "sites.yaml") if s.lat < -75]
    outside = [s.id for s in sites if not all(r.covers(s.lat, s.lon) for r in (sun, earth, psr))]
    if outside:
        print(f"outside these maps, skipped: {', '.join(outside)}")
    sites = [s for s in sites if s.id not in outside]
    if not sites:
        raise SystemExit("no site lies on these maps")
    samples = [(s.lat, s.lon) for s in sites if not s.derived]
    sun.calibrate(samples)
    earth.calibrate(samples)
    code = psr_code(psr, sun, samples[:6])

    out = {"source": SOURCE, "products": [sun.name, earth.name, psr.name], "psr_code": int(code),
           "note": ("18.6-year averages; Earth visible if any part of its disc shows; observer height not "
                    "stated. LunaNav: Nov 2026 - Dec 2028, 2 m mast, Earth's centre."), "sites": {}}
    print(f"\n{'site':40s} {'sun: Maz / ours(mean disk)':>28s} {'Earth: Maz / ours':>20s} {'PSR km':>7s} {'PSR km2<=5km':>12s}")
    for s in sites:
        v = load_series(s.id, data / "series")[0]
        m_sun, m_earth = sun.frac(sun.at(s.lat, s.lon)), earth.frac(earth.at(s.lat, s.lon))
        dist, area = psr_metrics(psr, code, s.lat, s.lon, a.radius_km * 1000)
        rec = {"mazarico_sun": round(m_sun, 4), "mazarico_earth": round(m_earth, 4),
               "psr_nearest_km": None if dist is None else round(dist, 2), "psr_area_within_5km_km2": round(area, 2)}
        ours = ""
        if v is not None:
            rec["lunanav_sun_mean"] = round(float(np.mean(v.sun_fraction)), 4)
            rec["lunanav_earth"] = round(float(np.mean(v.earth_visible)), 4)
            ours = f"{rec['lunanav_sun_mean']:.1%}"
        out["sites"][s.id] = rec
        print(f"{s.id:40s} {m_sun:>13.1%} / {ours:>12s} {m_earth:>9.1%} / "
              f"{(str(round(100 * rec.get('lunanav_earth', float('nan')), 1)) + '%'):>8s} "
              f"{'>' + str(int(a.radius_km)) if dist is None else f'{dist:.2f}':>7s} {area:12.2f}")
    out["skipped_outside_maps"] = outside
    out_path.write_text(json.dumps(out, indent=1))
    print(f"\nwrote {out_path}")
    return out


if __name__ == "__main__":
    main()
