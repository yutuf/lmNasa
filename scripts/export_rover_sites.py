"""Export the 5 m/px LOLA site maps (Barker et al. 2021, NASA PGDA product 78) for the web rover and lander views.

Each site is a 16 km (or larger) square in south polar stereographic metres. We average 2x2 pixels to 10 m and
write web/public/data/sites/<id>.bin: header uint32 rows, cols; float32 m_per_px, x0, y0 (centre of pixel [0, 0];
rows go toward -y), scale; then int16 heights (m / scale) relative to the 1737.4 km sphere, like the LOLA LDEMs.
web/public/data/sites.json lists the sites with their bounds.

Run: .venv/Scripts/python scripts/export_rover_sites.py   (after scripts/fetch_more_data.sh / data/lola5m download)
"""
import json
from pathlib import Path

import numpy as np
import rasterio

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "lola5m"
OUT = ROOT / "web" / "public" / "data" / "sites"
NAMES = {
    "Site01": "Connecting ridge", "Site04": "Shackleton rim", "Site06": "Nobile rim 1", "Site07": "Peak near Shackleton",
    "Site11": "de Gerlache rim", "Site20v2": "Leibnitz beta plateau", "Site23": "Malapert massif",
    "Site42": "de Gerlache–Kocher massif", "DM1": "DM1", "DM2": "Nobile rim 2", "SL2": "SL2",
}
SCALE = 0.25  # m per int16 step: ±8 km range


def export(site: str) -> dict | None:
    f = SRC / site / f"{site}_final_adj_5mpp_surf.tif"
    if not f.exists():
        return None
    with rasterio.open(f) as r:
        z = r.read(1).astype(np.float64)
        nod = r.nodata
        b = r.bounds
        res = r.res[0]
    if nod is not None:
        z[z == nod] = np.nan
    z[~np.isfinite(z) | (np.abs(z) > 20000)] = np.nan
    if np.isnan(z).any():  # fill the few gaps with the mean so int16 stays valid
        z[np.isnan(z)] = np.nanmean(z)
    h, w = (z.shape[0] // 2) * 2, (z.shape[1] // 2) * 2
    z = z[:h, :w].reshape(h // 2, 2, w // 2, 2).mean(axis=(1, 3))
    m = res * 2
    x0 = b.left + m / 2
    y0 = b.top - m / 2
    q = np.clip(np.round(z / SCALE), -32767, 32767).astype("<i2")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{site.lower()}.bin").write_bytes(np.array([q.shape[0], q.shape[1]], "<u4").tobytes()
        + np.array([m, x0, y0, SCALE], "<f4").tobytes() + q.tobytes())
    cx, cy = (b.left + b.right) / 2, (b.top + b.bottom) / 2
    lat = -90 + 2 * np.degrees(np.arctan(np.hypot(cx, cy) / (2 * 1737400)))
    lon = float(np.degrees(np.arctan2(cx, cy)) % 360)
    return {"id": site.lower(), "name": NAMES.get(site, site), "file": f"sites/{site.lower()}.bin", "m_per_px": m,
            "bounds_m": [b.left, b.bottom, b.right, b.top], "center": [round(float(lat), 4), round(lon, 3)],
            "z_range_m": [round(float(z.min())), round(float(z.max()))]}


def main():
    sites = [s for s in (export(k) for k in NAMES) if s]
    meta = {"source": "LOLA 5 m/px site maps, Barker et al. 2021 (NASA GSFC PGDA product 78), averaged to 10 m",
            "sites": sites}
    (OUT.parent / "sites.json").write_text(json.dumps(meta, indent=1))
    for s in sites:
        print(s["id"], s["name"], s["center"], s["z_range_m"])


if __name__ == "__main__":
    main()
