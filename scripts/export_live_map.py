"""Crop the south-polar cap texture to the 2 km search grid (85 S to the pole) for the live session's phone map.

Out: web/public/data/live_map.jpg, square, north-up = 0 E at the top, 90 E to the right (same as pole_albedo.jpg).
The phone maps a tap back to lat/lon with the same stereographic projection (web/src/live.ts, MAP_R_KM).
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

DATA = Path(__file__).resolve().parents[1] / "web" / "public" / "data"
MAP_R_KM = 155.0          # keep in step with web/src/live.ts


def main():
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    r_max_km = manifest["pole_cap"]["r_max_m"] / 1000
    def cropped(name):
        im = Image.open(DATA / name)
        n = im.size[0]
        half = MAP_R_KM / r_max_km * n / 2
        c = n / 2
        return im.crop((round(c - half), round(c - half), round(c + half), round(c + half))).resize((800, 800), Image.LANCZOS)
    height = np.asarray(cropped("pole_albedo.jpg").convert("L"), dtype=np.float64) / 255
    nrm = np.asarray(cropped("pole_normal.jpg").convert("RGB"), dtype=np.float64) / 127.5 - 1
    nrm /= np.linalg.norm(nrm, axis=2, keepdims=True)
    az, el = np.radians(315), np.radians(35)                         # map light from the upper left, as maps are read
    light = np.array([np.cos(el) * np.sin(az), np.cos(el) * np.cos(az), np.sin(el)])
    shade = np.clip(nrm @ light, 0, 1)
    a = 0.75 * shade + 0.25 * height
    lo, hi = np.percentile(a, [1, 99.5])
    a = np.clip((a - lo) / (hi - lo), 0, 1) * 225 + 18
    out = Image.fromarray(a.astype(np.uint8), "L").convert("RGB")
    out.save(DATA / "live_map.jpg", quality=84)
    print("live_map.jpg", (DATA / "live_map.jpg").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
