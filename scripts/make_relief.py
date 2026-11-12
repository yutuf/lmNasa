"""3D-printable terrain relief (watertight STL) of a south-pole tile from a LOLA polar DEM.

Reads the PDS LOLA polar product (16-bit .img, polar stereographic, e.g. ldem_85s_40m.img from
https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/),
cuts a square tile around the given sites and writes:

  <out>.stl   solid block: terrain on top, flat base, true vertical scale by default (millimetres)
  <out>.json  model-space position of every site (for pins / labels in CAD) and the tile metadata

Example (the Malapert Massif tile used in the demo):

  python scripts/make_relief.py data/dem/ldem_85s_40m.img \
      --sites malapert_massif malapert_massif_derived malapert_massif_region_best \
      --size-km 24 --scale 200000 --out hardware/relief/malapert_massif
"""
import argparse
import json
import math
import re
from pathlib import Path

import numpy as np

from lunanav.sites import load_sites

R_MOON_M = 1737400.0


def read_label(img_path: Path) -> dict:
    """The few numbers we need from the PDS3 label next to the image."""
    text = img_path.with_suffix(".lbl").read_text(errors="replace")

    def num(key):
        return float(re.search(rf"^\s*{key}\s*=\s*([-0-9.eE+]+)", text, re.M).group(1))

    return {
        "lines": int(num("LINES")),
        "samples": int(num("LINE_SAMPLES")),
        "dn_to_m": num("SCALING_FACTOR"),
        "m_per_px": num("MAP_SCALE"),
        "line0": num("LINE_PROJECTION_OFFSET"),
        "sample0": num("SAMPLE_PROJECTION_OFFSET"),
    }


def south_polar_xy(lat_deg, lon_deg):
    """South polar stereographic, metres: +y toward lon 0 (Earth side), +x toward lon 90 E."""
    r = 2.0 * R_MOON_M * math.tan(math.radians(90.0 + lat_deg) / 2.0)
    return r * math.sin(math.radians(lon_deg)), r * math.cos(math.radians(lon_deg))


def solid_from_heights(z, dx, base):
    """Triangles (n, 3, 3) of a closed block: z[row, col] on top, flat bottom at -base.

    Rows run north to south in the image, so y decreases with the row index.
    """
    ny, nx = z.shape
    xs = np.arange(nx) * dx
    ys = (ny - 1 - np.arange(ny)) * dx
    X, Y = np.meshgrid(xs, ys)
    top = np.stack([X, Y, z], axis=-1)
    a, b, c, d = top[:-1, :-1], top[:-1, 1:], top[1:, :-1], top[1:, 1:]
    tris = [np.stack([a, c, b], axis=-2).reshape(-1, 3, 3), np.stack([b, c, d], axis=-2).reshape(-1, 3, 3)]

    # Boundary loop, counter-clockwise seen from above: south edge W->E, east S->N, north E->W, west N->S.
    loop = np.concatenate([top[-1, :], top[-2::-1, -1], top[0, -2::-1], top[1:-1, 0]])
    nxt = np.roll(loop, -1, axis=0)
    floor, floor_nxt = loop.copy(), nxt.copy()
    floor[:, 2] = floor_nxt[:, 2] = -base
    tris.append(np.stack([loop, floor, nxt], axis=1))          # walls
    tris.append(np.stack([nxt, floor, floor_nxt], axis=1))
    centre = np.array([xs[-1] / 2.0, ys[0] / 2.0, -base])
    tris.append(np.stack([floor_nxt, floor, np.broadcast_to(centre, floor.shape)], axis=1))  # bottom fan
    return np.concatenate(tris)


def write_binary_stl(path: Path, tris: np.ndarray, name: str):
    normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    lengths = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = np.divide(normals, lengths, out=np.zeros_like(normals), where=lengths > 0)
    rec = np.zeros(len(tris), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])
    rec["n"], rec["v"] = normals, tris
    with open(path, "wb") as f:
        f.write(name.encode("ascii", "replace")[:80].ljust(80, b" "))
        f.write(np.uint32(len(tris)).tobytes())
        f.write(rec.tobytes())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dem", type=Path, help="PDS LOLA polar .img (its .lbl must sit next to it)")
    ap.add_argument("--sites", nargs="+", required=True, help="site ids; the tile is centred on them")
    ap.add_argument("--size-km", type=float, default=24.0, help="tile edge length")
    ap.add_argument("--scale", type=float, default=200000.0, help="map scale 1:N")
    ap.add_argument("--step", type=int, default=3, help="use every Nth DEM pixel")
    ap.add_argument("--exaggeration", type=float, default=1.0, help="vertical exaggeration (1 = true scale)")
    ap.add_argument("--base-mm", type=float, default=3.0, help="solid base below the lowest terrain point")
    ap.add_argument("--out", type=Path, required=True, help="output path without extension")
    args = ap.parse_args()

    lab = read_label(args.dem)
    dem = np.memmap(args.dem, dtype="<i2", mode="r", shape=(lab["lines"], lab["samples"]))
    known = {s.id: s for s in load_sites()}
    sites = [known[i] for i in args.sites]
    xy = np.array([south_polar_xy(s.lat, s.lon) for s in sites])
    cx, cy = (xy.min(axis=0) + xy.max(axis=0)) / 2.0

    half_px = int(round(args.size_km * 500.0 / lab["m_per_px"]))
    col_c = int(round(lab["sample0"] + cx / lab["m_per_px"]))
    row_c = int(round(lab["line0"] - cy / lab["m_per_px"]))
    r0, c0 = row_c - half_px, col_c - half_px
    if r0 < 0 or c0 < 0 or row_c + half_px >= lab["lines"] or col_c + half_px >= lab["samples"]:
        raise SystemExit("tile reaches outside the DEM; use a product that covers lower latitudes")
    tile_m = np.asarray(dem[r0:row_c + half_px + 1:args.step, c0:col_c + half_px + 1:args.step], dtype=np.float64)
    tile_m *= lab["dn_to_m"]

    mm_per_m = 1000.0 / args.scale
    dx_mm = lab["m_per_px"] * args.step * mm_per_m
    z_min = tile_m.min()
    z_mm = (tile_m - z_min) * mm_per_m * args.exaggeration
    tris = solid_from_heights(z_mm, dx_mm, args.base_mm)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    stl = args.out.with_suffix(".stl")
    write_binary_stl(stl, tris, f"LunaNav relief 1:{args.scale:.0f} LOLA {lab['m_per_px']:.0f} m")

    edge_mm = (tile_m.shape[1] - 1) * dx_mm
    pins = []
    for s, (x, y) in zip(sites, xy):
        col = (lab["sample0"] + x / lab["m_per_px"] - c0) / args.step
        row = (lab["line0"] - y / lab["m_per_px"] - r0) / args.step
        height_m = float(tile_m[int(round(row)), int(round(col))])
        pins.append({
            "id": s.id, "name": s.name, "lat": s.lat, "lon": s.lon, "elevation_m": round(height_m, 1),
            "x_mm": round(col * dx_mm, 3), "y_mm": round(edge_mm - row * dx_mm, 3),
            "z_mm": round((height_m - z_min) * mm_per_m * args.exaggeration, 3),
        })
    meta = {
        "dem": args.dem.name, "m_per_px": lab["m_per_px"], "step": args.step, "scale": args.scale,
        "exaggeration": args.exaggeration, "size_km": args.size_km, "edge_mm": round(edge_mm, 3),
        "base_mm": args.base_mm, "relief_mm": round(float(z_mm.max()), 3),
        "elevation_min_m": float(z_min), "elevation_max_m": float(tile_m.max()),
        "orientation": "+y = toward lon 0 (Earth side), +x = toward lon 90 E", "triangles": int(len(tris)),
        "sites": pins,
    }
    args.out.with_suffix(".json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{stl}: {len(tris)} triangles, {edge_mm:.1f} mm square, relief {z_mm.max():.1f} mm")
    for p in pins:
        print(f"  {p['id']}: elevation {p['elevation_m']:.0f} m at ({p['x_mm']:.1f}, {p['y_mm']:.1f}, {p['z_mm']:.1f}) mm")


if __name__ == "__main__":
    main()
