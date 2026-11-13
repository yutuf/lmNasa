"""Export permanent shadow, long-term Sun/Earth visibility and ice favorability around the south pole for the web.

Sources (all public, downloaded by scripts/fetch_more_data.sh and the PGDA product 69 download):
  LPSR_85S_060M_201608.TIF        permanently shadowed regions, Mazarico et al. 2011 (NASA GSFC PGDA product 69)
  AVGVISIB_85S_060M_201608*.TIF   average Sun and Earth visibility, same product
  Moon_IceFavorabilityIndex_90S000E_591mp.tif   USGS Astrogeology ice favorability index

Writes web/public/data/psr.bin: header uint32 n, float32 m_per_px, half_extent_m; then four uint8 n*n layers in
south polar stereographic (rows from +y down, like the LOLA products): PSR fraction, average sunlight, average Earth
visibility, ice favorability index; each 0..255 = 0..1 (ice: 0..255 = 0..0.85, the map's maximum).
"""
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
ILL = ROOT / "data" / "illumination"
ICE = ROOT / "data" / "usgs" / "Lunar_Research" / "IceFavorabilityIndex" / "Moon_IceFavorabilityIndex_90S000E_591mp.tif"
OUT = ROOT / "web" / "public" / "data" / "psr.bin"
BLOCK = 4  # 60 m -> 240 m


def block_mean(a: np.ndarray, k: int) -> np.ndarray:
    h, w = (a.shape[0] // k) * k, (a.shape[1] // k) * k
    return np.nanmean(a[:h, :w].reshape(h // k, k, w // k, k), axis=(1, 3))


def layer(name: str) -> tuple[np.ndarray, rasterio.coords.BoundingBox]:
    with rasterio.open(ILL / name) as r:
        a = r.read(1).astype(np.float64)
        a[a == r.nodata] = np.nan
        return a * r.scales[0] + r.offsets[0], r.bounds


def main():
    psr, b = layer("LPSR_85S_060M_201608.TIF")
    sun, _ = layer("AVGVISIB_85S_060M_201608.TIF")
    earth, _ = layer("AVGVISIB_85S_060M_201608_EARTH.TIF")
    layers = [block_mean(x, BLOCK) for x in (psr, sun, earth)]
    n = layers[0].shape[0]
    m = 60.0 * BLOCK
    half = (b.right - b.left) / 2
    # ice favorability: different stereographic (true scale at 70 S), resample by nearest neighbour
    xs = -half + m / 2 + np.arange(n) * m
    X, Y = np.meshgrid(xs, -xs)  # row 0 at +y
    pole = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m"
    with rasterio.open(ICE) as r:
        ice = r.read(1).astype(np.float64)
        ice[~np.isfinite(ice) | (ice < 0) | (ice > 10)] = np.nan
        tr = Transformer.from_crs(pole, r.crs.to_proj4(), always_xy=True)
        ix, iy = tr.transform(X, Y)
        inv = ~r.transform
        cols, rows = inv * (ix.ravel(), iy.ravel())
        rows, cols = np.floor(rows).astype(int), np.floor(cols).astype(int)
        rows = np.clip(np.array(rows), 0, r.height - 1)
        cols = np.clip(np.array(cols), 0, r.width - 1)
        layers.append(ice[rows, cols].reshape(n, n) / 0.85)
    data = b"".join(np.nan_to_num(np.clip(x, 0, 1) * 255, nan=0).round().astype(np.uint8).tobytes() for x in layers)
    OUT.write_bytes(np.array([n], "<u4").tobytes() + np.array([m, half], "<f4").tobytes() + data)
    print(f"{OUT.name}: {n}x{n} at {m:.0f} m, {OUT.stat().st_size / 1e6:.1f} MB; PSR share {np.nanmean(layers[0] > 0.5):.3f}")


if __name__ == "__main__":
    main()
