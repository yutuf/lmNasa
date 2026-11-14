"""Real landings replayed through LunaNav's model: hourly Sun and Earth around five recent landings.

  python scripts/build_history.py

For each landing below: the same hourly quantities as ephem.bin (apparent Sun direction and Earth position in the
Moon ME frame, Sun apparent radius, DSN visibility), from one day before touchdown to 18 days after, computed with
the same code and kernels as scripts/build_ephem_web.py. Written to web/public/data/history.json; the web app runs
its own engine on these hours and compares the result with what each mission actually did.

Landing times and places are the published ones (agency releases, LROC; see data/landed_missions.yaml).
"""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
from build_ephem_web import compute  # noqa: E402

# name, landing time (UTC), lat, lon (east, -180..180), what happened (en, tr), days it worked on the surface
LANDINGS = [
    ("Chandrayaan-3", "2023-08-23T12:33", -69.373, 32.319,
     "Landed upright. Worked through the lunar day; put to sleep on 2–4 September ahead of sunset and did not wake after the night.",
     "Dik indi. Ay günü boyunca çalıştı; gün batımından önce 2–4 Eylül’de uyutuldu, geceden sonra uyanmadı.", 11),
    ("SLIM", "2024-01-19T15:20", -13.316, 25.251,
     "Landed nose-down with its solar cells facing west: no power at first; it woke on 28 January when the Sun moved west.",
     "Burnu üstüne indi, güneş hücreleri batıya bakıyordu: önce güç yok; Güneş batıya geçince 28 Ocak’ta uyandı.", 12),
    ("IM-1 Odysseus", "2024-02-22T23:23", -80.13, 1.44,
     "Tipped onto its side at touchdown; worked about 7 days, until its power faded on 29 February.",
     "İnişte yan yattı; gücü 29 Şubat’ta tükenene kadar yaklaşık 7 gün çalıştı.", 7),
    ("Chang'e 6", "2024-06-01T22:23", -41.63, -153.99,
     "Far side: Earth never in view. All contact through the Queqiao-2 relay; collected samples and lifted off after about 2 days.",
     "Uzak yüz: Dünya hiç görünmez. Tüm iletişim Queqiao-2 rölesiyle; örnek topladı ve yaklaşık 2 gün sonra kalktı.", 2),
    ("Blue Ghost 1", "2025-03-02T08:34", 18.56, 61.81,
     "Landed upright in Mare Crisium; worked the whole lunar day, about 14 days, and some 5 hours into the night (16 March).",
     "Kriz Denizi’ne dik indi; tüm Ay gününü, yaklaşık 14 gün, ve gecenin ilk 5 saatini çalıştı (16 Mart).", 14),
]
BEFORE_H, AFTER_H = 24, 18 * 24


def main():
    out = []
    for name, t, lat, lon, en, tr, days in LANDINGS:
        land = int(np.datetime64(t, "s").astype(np.int64))
        land -= land % 3600                                      # on the hour, like ephem.bin
        unix = np.arange(land - BEFORE_H * 3600, land + AFTER_H * 3600, 3600, dtype=np.int64)
        print(name, len(unix), "hours")
        _, sun, earth, dsn = compute(unix)
        # the Sun's apparent radius seen from the Moon, from the Moon-Sun distance
        try:
            from skyfield.api import Loader
            from build_ephem_web import kernels, KERNELS
            load = Loader(str(KERNELS), verbose=False)
            eph = load(kernels()[0]); ts = load.timescale()
            tt = ts.utc(1970, 1, 1, 0, 0, unix.astype(float))
            d_km = eph["moon"].at(tt).observe(eph["sun"]).distance().km
            sun_r = np.degrees(np.arcsin(695700.0 / d_km))
        except Exception:
            sun_r = np.full(len(unix), 0.2666)
        out.append({
            "name": name, "lat": lat, "lon": lon, "landingUnix": land, "firstUnix": int(unix[0]), "hours": len(unix),
            "workedDays": days, "outcome": {"en": en, "tr": tr},
            "sun": np.round(sun, 6).T.tolist(), "earth": np.round(earth, 1).T.tolist(),
            "sunR": np.round(sun_r, 5).tolist(), "dsn": dsn.astype(int).tolist(),
        })
    path = ROOT / "web" / "public" / "data" / "history.json"
    path.write_text(json.dumps({"landings": out}, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
