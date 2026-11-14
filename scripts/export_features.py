"""Export IAU-approved lunar feature names near the south pole for the web (nearest-feature labels).

Source: IAU Gazetteer of Planetary Nomenclature, USGS Astrogeology (MOON_nomenclature_center_pts shapefile,
asc-planetarynames-data bucket). Writes web/public/data/features.json: [name, lat, lon (0-360 E), diameter km, type].
"""
import json
from pathlib import Path

import shapefile

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "gazetteer" / "MOON_nomenclature_center_pts.shp"
OUT = ROOT / "web" / "public" / "data" / "features.json"


def main():
    r = shapefile.Reader(str(SRC), encoding="utf-8")
    out = []
    for rec in r.records():
        d = rec.as_dict()
        lat, lon = float(d["center_lat"]), float(d["center_lon"]) % 360
        if lat > -78 or str(d.get("approval", "")).lower().startswith("dropped"):
            continue
        out.append([d["clean_name"] or d["name"], round(lat, 4), round(lon, 4), round(float(d["diameter"] or 0), 1), d["type"]])
    out.sort(key=lambda f: -f[3])
    OUT.write_text(json.dumps({"source": "IAU Gazetteer of Planetary Nomenclature (USGS Astrogeology)", "features": out},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(out)} features south of 78 S -> {OUT.name} ({OUT.stat().st_size / 1e3:.0f} kB); largest: {[f[0] for f in out[:5]]}")


if __name__ == "__main__":
    main()
