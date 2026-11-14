"""Offline: best point within ~1 km of each cited site -> data/derived_sites.yaml.

usage: python scripts/derive_best_points.py path/to/LDEM_80S_40MPP_ADJ.TIF
                                            [--radius 1000] [--spacing 100] [--max-slope 10]

Needs only the DEM and the already-precomputed series of the cited sites
(data/series/<site>.npz); no ephemeris kernels. For each cited, non-reference
site it:
  1. lays a grid of candidates (default 100 m spacing) inside the radius,
  2. drops candidates steeper than --max-slope (40 m baseline),
  3. builds a 360 deg horizon for each remaining candidate,
  4. reprojects the cited site's Sun/Earth alt-az into the candidate's frame,
  5. ranks by share of hours with Sun (>= 50 % disk) AND Earth in view, tie-break Sun.
The winner is written as a separate site with `derived_from`, plus its horizon
(data/horizons.json) and series (data/series/<id>.npz). The cited point is untouched.
"""
import argparse
import sys
import time
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from lunanav.derive import candidate_grid, rank_candidates, score_point, slope_deg  # noqa: E402
from lunanav.horizon import compute_horizon, dem_sampler, load_profiles, save_profiles  # noqa: E402
from lunanav.series import load_series  # noqa: E402
from lunanav.sites import load_sites  # noqa: E402

COMPASS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

ap = argparse.ArgumentParser()
ap.add_argument("dem")
ap.add_argument("--radius", type=float, default=1000.0, help="search radius around the cited point, m")
ap.add_argument("--spacing", type=float, default=100.0, help="candidate grid spacing, m")
ap.add_argument("--max-slope", type=float, default=10.0, help="max landing slope, deg")
ap.add_argument("--step", type=float, default=120.0, help="horizon ray step, m")
ap.add_argument("--max-km", type=float, default=150.0, help="horizon ray length, km")
ap.add_argument("--sites", nargs="*", help="only these site ids")
ap.add_argument("--data", default=str(ROOT / "data"), help="data folder (sites.yaml, horizons.json, series/)")
args = ap.parse_args()

sample = dem_sampler(args.dem)
dem_name = Path(args.dem).name
data_dir = Path(args.data)
hz_path = data_dir / "horizons.json"
profiles = load_profiles(hz_path) if hz_path.exists() else {}
out_dir = data_dir / "series"
derived_path = data_dir / "derived_sites.yaml"
old = yaml.safe_load(derived_path.read_text(encoding="utf-8"))["sites"] if derived_path.exists() else []


def horizon_at(lat, lon, sid="candidate"):
    return compute_horizon(sample, sid, float(lat), float(lon), step_m=args.step,
                           max_distance_m=args.max_km * 1000, source=dem_name)


derived = []
cited_sites = [s for s in load_sites(data_dir / "sites.yaml", include_derived=False) if not s.reference]
for s in cited_sites:
    if args.sites and s.id not in args.sites:
        continue
    vis, step_h, _ = load_series(s.id, out_dir)
    # forget any previous derived result for this site (kept only if re-derived below)
    old = [d for d in old if d["id"] != f"{s.id}_derived"]   # region-best entries are left alone
    profiles.pop(f"{s.id}_derived", None)
    (out_dir / f"{s.id}_derived.npz").unlink(missing_ok=True)
    if vis is None:
        print(f"{s.id}: no series, run precompute.py first")
        continue
    if not np.isfinite(sample(np.array([s.lat]), np.array([s.lon]))[0]):
        print(f"{s.id}: outside the DEM, skipped")
        continue
    t0 = time.time()
    cand = candidate_grid(s.lat, s.lon, args.radius, args.spacing)
    try:
        ranked = rank_candidates(vis, s.lat, s.lon, cand, horizon_at, sample, args.max_slope)
    except ValueError as e:   # candidate outside DEM
        print(f"{s.id}: skipped ({e})")
        continue
    if not ranked:
        print(f"{s.id}: no candidate under {args.max_slope} deg slope")
        continue
    best = ranked[0]
    c_slope = float(slope_deg(sample, s.lat, s.lon)[0])
    c_hz = horizon_at(s.lat, s.lon, s.id)   # same DEM + settings as the candidates (fair comparison)
    cz = score_point(vis, s.lat, s.lon, s.lat, s.lon, c_hz)
    c_lit = cz["sun_fraction"] >= 0.5
    c_both = float((c_lit & cz["earth_visible"]).mean())
    print(f"{s.id:20s} {len(ranked):4d} candidates <= {args.max_slope:.0f} deg in {time.time() - t0:5.1f} s | "
          f"cited: both {c_both:.1%} sun {c_lit.mean():.1%} earth {cz['earth_visible'].mean():.1%} "
          f"slope {c_slope:.1f} | best: both {best.both_frac:.1%} sun {best.sun_frac:.1%} "
          f"earth {best.earth_frac:.1%} slope {best.slope_deg:.1f} at {best.distance_m:.0f} m "
          f"{COMPASS8[int((best.bearing_deg + 22.5) // 45) % 8]}")
    if best.distance_m == 0 or best.both_frac <= c_both:
        print(f"{'':20s} cited point is already the best within {args.radius:.0f} m; no derived point")
        continue

    did = f"{s.id}_derived"
    hz = horizon_at(best.lat, best.lon, did)
    profiles[did] = hz
    z = score_point(vis, s.lat, s.lon, best.lat, best.lon, hz)
    np.savez_compressed(
        out_dir / f"{did}.npz",
        times=vis.times_utc.astype("datetime64[s]").astype("int64"), step_h=step_h,
        **{k: np.asarray(v, dtype=bool if k == "earth_visible" else "float32") for k, v in z.items()},
        terrain=f"{dem_name} (derived point)",
    )
    direction = COMPASS8[int((best.bearing_deg + 22.5) // 45) % 8]
    derived.append(dict(
        id=did, name=f"{s.name} — derived best point",
        lat=round(best.lat, 5), lon=round(best.lon, 5), category="derived", derived_from=s.id, search="1 km",
        distance_m=round(best.distance_m), bearing_deg=round(best.bearing_deg, 1),
        slope_deg=round(best.slope_deg, 1), cited_slope_deg=round(c_slope, 1),
        note=(f"Computed by LunaNav, not from a publication: best of {len(ranked)} grid points "
              f"({args.spacing:.0f} m spacing, slope <= {args.max_slope:.0f} deg) within {args.radius:.0f} m "
              f"of the cited point; {best.distance_m:.0f} m {direction} of it. Objective: hours with Sun "
              f"and Earth both in view, {best.both_frac:.1%} vs {c_both:.1%} at the cited point "
              f"({vis.times_utc[0].astype('datetime64[D]')} to {vis.times_utc[-1].astype('datetime64[D]')})."),
        source=f"derived from {s.id} with {dem_name}",
        verified=False,
    ))

save_profiles(list(profiles.values()), hz_path)
out = derived_path
derived = old + derived
out.write_text("# GENERATED by scripts/derive_best_points.py and scripts/derive_region_best.py -\n"
               "# computed points, NOT published coordinates.\n"
               + yaml.safe_dump({"sites": derived}, sort_keys=False, allow_unicode=True), encoding="utf-8")
print("wrote", out, "and", hz_path)
