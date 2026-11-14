"""Export Diviner south-polar temperatures and ice stability depth for the web, on the psr.bin grid (240 m).

Source: LRO Diviner Lunar Radiometer, Polar Resource Product (Paige et al., UCLA; PDS lro_diviner_derived1,
data_derived_prp/dlre_prp_south.tab): a triangle mesh from 75.9 S to the pole with average and maximum surface
temperature (K) and the depth (m) below which water ice would be stable (-999 = nowhere within reach).

Writes web/public/data/thermal.bin: header uint32 n, float32 m_per_px, half_extent_m (same grid as psr.bin); then
uint8 n*n layers: average temperature (K, clipped to 255), maximum temperature (K / 2), ice stability depth
(cm, 0..250; 255 = no stable ice).
"""
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.ndimage import distance_transform_edt

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "diviner" / "dlre_prp_south.tab"
PSR = ROOT / "web" / "public" / "data" / "psr.bin"
OUT = ROOT / "web" / "public" / "data" / "thermal.bin"
R = 1737400.0


def main():
    head = np.frombuffer(PSR.read_bytes()[:12], dtype=np.uint8)
    n = int(np.frombuffer(head[:4].tobytes(), "<u4")[0])
    m, half = np.frombuffer(head[4:12].tobytes(), "<f4").astype(float)
    df = pd.read_csv(SRC, skipinitialspace=True, usecols=["tri_clon", "tri_clat", "temp_avg", "temp_max", "ice_depth"])
    lat = np.radians(df.tri_clat.to_numpy())
    lon = np.radians(df.tri_clon.to_numpy())
    rho = 2 * R * np.tan((np.pi / 2 + lat) / 2)
    x, y = rho * np.sin(lon), rho * np.cos(lon)
    col = np.floor((x + half) / m).astype(int)
    row = np.floor((half - y) / m).astype(int)
    ok = (col >= 0) & (row >= 0) & (col < n) & (row < n)
    k = row[ok] * n + col[ok]
    layers = []
    for name, fill in (("temp_avg", None), ("temp_max", None), ("ice_depth", None)):
        v = df[name].to_numpy()[ok].astype(float)
        if name == "ice_depth":
            v = np.where(v < 0, 9.99, v)          # no stable ice -> sentinel (kept separate from real depths)
        s = np.bincount(k, v, n * n)
        c = np.bincount(k, None, n * n)
        g = np.where(c > 0, s / np.maximum(c, 1), np.nan).reshape(n, n)
        # fill empty cells from the nearest filled one
        miss = np.isnan(g)
        if miss.any():
            idx = distance_transform_edt(miss, return_distances=False, return_indices=True)
            g = g[tuple(idx)]
        layers.append(g)
    avg = np.clip(np.round(layers[0]), 0, 255).astype(np.uint8)
    mx = np.clip(np.round(layers[1] / 2), 0, 255).astype(np.uint8)
    ice = np.where(layers[2] > 9, 255, np.clip(np.round(layers[2] * 100), 0, 250)).astype(np.uint8)
    OUT.write_bytes(np.array([n], "<u4").tobytes() + np.array([m, half], "<f4").tobytes() + avg.tobytes() + mx.tobytes() + ice.tobytes())
    cold = (layers[1] < 110).mean()
    print(f"{OUT.name}: {n}x{n}, {len(df):,} triangles, {OUT.stat().st_size / 1e6:.1f} MB; "
          f"avg T {np.nanmin(layers[0]):.0f}-{np.nanmax(layers[0]):.0f} K; share never above 110 K: {cold:.3f}; "
          f"stable ice within 1 m: {(ice <= 100).mean():.3f}")


if __name__ == "__main__":
    main()
