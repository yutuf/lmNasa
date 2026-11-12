"""Offline diagnostic: are two NASA illumination maps registered to each other?

usage: python scripts/check_map_alignment.py COARSE.TIF FINE.TIF [--lat-min -89.5 --lat-max -85.5]
                                             [--max-shift 240] [--step 30] [--n 20000]
e.g.   python scripts/check_map_alignment.py AVGVISIB_75S_120M_201608.TIF AVGVISIB_85S_060M_201608.TIF

Why: comparing LunaNav with NASA at single points agreed well on smooth ground but not on
narrow ridges, where NASA's own 120 m and 60 m maps also disagree (Shackleton ridge 78 % vs 44 %).
That smells like a registration offset: one pixel off a crest changes the value a lot.

Method: take random pixel centres of the coarse map inside a latitude band, average the fine map
over each coarse pixel's footprint (block mean of the fine pixels whose centres fall inside it),
and repeat with the fine map shifted by (dx, dy) on a grid of trial shifts. A correctly registered
pair has its smallest mismatch at (0, 0); a best shift of at most half a fine pixel, or one that
lowers the mismatch by under 5 %, is within what this method can resolve and counts as registered.
Prints the RMS mismatch at (0, 0), the best shift and
its RMS. Values are compared after each map's scale/offset tags. Needs rasterio + pyproj.
"""
import argparse

import numpy as np

GEO = "+proj=longlat +R=1737400 +no_defs +type=crs"


def load(path):
    import rasterio
    src = rasterio.open(path)
    raw = src.read(1)
    val = raw.astype(float) * float(src.scales[0] or 1.0) + float(src.offsets[0] or 0.0)
    if src.nodata is not None:
        val[raw == src.nodata] = np.nan
    return src, val


def block_mean(fine_src, fine_val, xs, ys, half, dx=0.0, dy=0.0):
    """Mean of fine pixels whose centres fall in the square (x +- half, y +- half), map shifted by (dx, dy).
    Vectorised over all points."""
    inv = ~fine_src.transform
    k = int(round(half / abs(fine_src.transform.a)))      # fine pixels per half coarse pixel
    # fine map shifted by (dx, dy): its value at (x, y) comes from (x - dx, y - dy)
    c = inv.a * (xs - dx) + inv.b * (ys - dy) + inv.c       # explicit affine (no deprecated `*`)
    r = inv.d * (xs - dx) + inv.e * (ys - dy) + inv.f
    c0, r0 = np.floor(c - k + 0.5).astype(int), np.floor(r - k + 0.5).astype(int)
    ok = (r0 >= 0) & (c0 >= 0) & (r0 + 2 * k <= fine_val.shape[0]) & (c0 + 2 * k <= fine_val.shape[1])
    out = np.full(len(xs), np.nan)
    if ok.any():
        di, dj = np.meshgrid(np.arange(2 * k), np.arange(2 * k), indexing="ij")
        block = fine_val[r0[ok, None] + di.ravel(), c0[ok, None] + dj.ravel()]
        with np.errstate(all="ignore"):
            out[ok] = np.nanmean(block, axis=1)
    return out


def main(argv=None):
    from pyproj import CRS, Transformer
    ap = argparse.ArgumentParser()
    ap.add_argument("coarse")
    ap.add_argument("fine")
    ap.add_argument("--lat-min", type=float, default=-89.5)
    ap.add_argument("--lat-max", type=float, default=-85.5)
    ap.add_argument("--max-shift", type=float, default=240.0, help="largest trial shift, m")
    ap.add_argument("--step", type=float, default=30.0, help="trial shift step, m")
    ap.add_argument("--n", type=int, default=20000, help="random coarse pixels to compare")
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args(argv)

    cs, cv = load(a.coarse)
    fs, fv = load(a.fine)
    if CRS.from_user_input(cs.crs) != CRS.from_user_input(fs.crs):
        raise SystemExit(f"different projections:\n  {cs.crs}\n  {fs.crs}\n(this check assumes the same one)")
    cpix = abs(cs.transform.a)
    print(f"coarse {a.coarse}: {cpix:.0f} m/px | fine {a.fine}: {abs(fs.transform.a):.0f} m/px | same CRS")

    # random coarse pixel centres inside the latitude band and valid in the coarse map
    rng = np.random.default_rng(a.seed)
    to_geo = Transformer.from_crs(cs.crs, CRS.from_proj4(GEO), always_xy=True)
    rows = rng.integers(0, cv.shape[0], a.n * 4)
    cols = rng.integers(0, cv.shape[1], a.n * 4)
    xs, ys = (np.asarray(t) for t in cs.xy(rows, cols))
    _, lat = to_geo.transform(xs, ys)
    keep = (lat >= a.lat_min) & (lat <= a.lat_max) & np.isfinite(cv[rows, cols])
    rows, cols, xs, ys = rows[keep][:a.n], cols[keep][:a.n], xs[keep][:a.n], ys[keep][:a.n]
    ref = cv[rows, cols]
    print(f"{len(ref)} coarse pixels between {a.lat_min} and {a.lat_max} deg")

    shifts = np.arange(-a.max_shift, a.max_shift + 1e-9, a.step)
    results = {}
    for dx in shifts:
        for dy in shifts:
            fm = block_mean(fs, fv, xs, ys, cpix / 2, dx, dy)
            ok = np.isfinite(fm) & np.isfinite(ref)
            results[(dx, dy)] = (float(np.sqrt(np.mean((fm[ok] - ref[ok]) ** 2))), int(ok.sum()))
    rms0, n0 = results[(0.0, 0.0)]
    (bx, by), (rmsb, nb) = min(results.items(), key=lambda kv: kv[1][0])
    print(f"RMS mismatch at zero shift: {rms0:.4f} ({n0} pixels)")
    print(f"best shift: dx = {bx:+.0f} m, dy = {by:+.0f} m -> RMS {rmsb:.4f} ({nb} pixels)")
    fine_pix = abs(fs.transform.a)
    gain = (rms0 - rmsb) / rms0 if rms0 > 0 else 0.0
    small_shift = max(abs(bx), abs(by)) <= fine_pix / 2      # below what this block method can resolve
    registered = (bx, by) == (0.0, 0.0) or small_shift or gain < 0.05
    print(f"improvement over zero shift: {gain:.1%}")
    print("verdict:", "registered: no meaningful offset (best shift within half a fine pixel or < 5 % better)"
          if registered else f"OFFSET: the fine map lines up best when shifted by ({bx:+.0f}, {by:+.0f}) m")
    return {"rms_zero": rms0, "best_shift_m": (bx, by), "rms_best": rmsb, "registered": registered}


if __name__ == "__main__":
    main()
