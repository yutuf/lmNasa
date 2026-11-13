"""Write web/public/data/engine_expected.json: the Python engine (lunanav/engine.py) on sample atlas points.

web/src/engine.test.ts runs the TypeScript engine on the same points and must get the same answers.

  python scripts/export_engine_expected.py
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lunanav.engine import WEB_DATA, load_atlas, load_ephem, search_point  # noqa: E402
from lunanav.metrics import MissionConstraints  # noqa: E402
from lunanav.polar_grid import polar_xy  # noqa: E402
from lunanav.sites import load_sites  # noqa: E402


def main():
    m = json.loads((WEB_DATA / "manifest.json").read_text(encoding="utf-8"))
    atlas = load_atlas()
    sun, earth, sun_r = load_ephem(m["n"])
    dsn = np.frombuffer((WEB_DATA / "dsn.bin").read_bytes(), "u1").astype(bool)
    sites = {s.id: s for s in load_sites()}
    picks = []
    for sid in ("malapert_massif", "malapert_massif_region_best", "shackleton_ridge", "de_gerlache_rim", "mons_mouton"):
        x, y = (v / 1000.0 for v in polar_xy(sites[sid].lat, sites[sid].lon))
        picks.append(int(np.argmin(np.hypot(atlas["x"] - x, atlas["y"] - y))))
    picks += [0, atlas["n"] // 3, atlas["n"] // 2, atlas["n"] - 1]
    c = MissionConstraints()
    cases = []
    for first_hour, n_starts, need_dsn in ((7392, 10, False), (2000, 6, True)):
        for i in picks:
            r = search_point(atlas, sun, earth, sun_r, dsn, i, first_hour, n_starts, 24, 336, c, need_dsn)
            cases.append(dict(firstHour=first_hour, nStarts=n_starts, needDsn=need_dsn, **r))
    out = WEB_DATA / "engine_expected.json"
    out.write_text(json.dumps(cases, indent=0), encoding="utf-8")
    print(f"{len(cases)} cases -> {out}")
    for k in cases[:5]:
        print(f"  point {k['index']}: {k['lat']:.3f}, {k['lon']:.3f}  GO starts {k['goCount']}/10, best sun {k['sunFrac']:.0%}")


if __name__ == "__main__":
    main()
