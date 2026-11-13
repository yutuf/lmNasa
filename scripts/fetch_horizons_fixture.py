"""Fetch official JPL Horizons Sun/Earth positions for a few sites and save them as a test fixture.

Horizons (https://ssd.jpl.nasa.gov/horizons/) is the ephemeris service the challenge names as the
foundation for Sun and Earth positions. This script asks its public API (no key) for the apparent
azimuth and elevation of the Sun (10) and Earth (399) seen from points on the Moon (coord@301), and
writes tests/fixtures/horizons.json. tests/test_horizons.py then compares the committed series in
data/series/ against it, so CI checks LunaNav's ephemeris without network access.

  python scripts/fetch_horizons_fixture.py

Only rerun it on purpose (for example after changing sites or the data window): the fixture is meant
to stay fixed, and the file records when it was fetched.
"""
from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tests" / "fixtures" / "horizons.json"
API = "https://ssd.jpl.nasa.gov/api/horizons.api"

SITES = ["shackleton_ridge", "malapert_massif", "apollo_11"]
BODIES = {"sun": "10", "earth": "399"}
START, STOP, STEP = "2027-01-01 00:00", "2027-01-31 00:00", "6 h"
HEIGHT_KM = 0.002  # the series are computed for a 2 m mast above the reference sphere (scripts/precompute.py)


def site_coords(site_id: str) -> tuple[float, float]:
    for s in yaml.safe_load((ROOT / "data" / "sites.yaml").read_text(encoding="utf-8"))["sites"]:
        if s["id"] == site_id:
            return float(s["lat"]), float(s["lon"])
    raise SystemExit(f"{site_id} not in data/sites.yaml")


def query(body: str, lat: float, lon: float) -> str:
    params = {
        "format": "json", "COMMAND": f"'{body}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'coord@301'", "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon % 360:.6f},{lat:.6f},{HEIGHT_KM}'",
        "START_TIME": f"'{START}'", "STOP_TIME": f"'{STOP}'", "STEP_SIZE": f"'{STEP}'",
        "QUANTITIES": "'4'", "ANG_FORMAT": "'DEG'", "EXTRA_PREC": "'YES'", "CSV_FORMAT": "'YES'",
        "APPARENT": "'AIRLESS'", "TIME_DIGITS": "'MINUTES'",
    }
    url = API + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=180) as r:
        payload = json.load(r)
    if "error" in payload:
        raise SystemExit(payload["error"])
    return payload["result"]


def parse(text: str) -> list[dict]:
    """Rows between $$SOE and $$EOE: date, two flag columns, azimuth, elevation."""
    body = text.split("$$SOE")[1].split("$$EOE")[0]
    rows = []
    for line in body.strip().splitlines():
        cols = [c.strip() for c in line.split(",")]
        t = datetime.strptime(cols[0], "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc)
        nums = [c for c in cols[1:] if re.fullmatch(r"-?\d+(\.\d+)?", c)]
        rows.append({"utc": t.strftime("%Y-%m-%dT%H:%M"), "az_deg": float(nums[0]), "el_deg": float(nums[1])})
    return rows


def header_notes(text: str) -> list[str]:
    """Header lines that say how Horizons interpreted the observer, kept for the record."""
    keep = ("Center geodetic", "Center cylindric", "Center radii", "Center body name", "Center-site name",
            "Target body name", "Atmos refraction", "RA format", "Time format", "Ephemeris")
    return [ln.strip() for ln in text.split("$$SOE")[0].splitlines() if ln.strip().startswith(keep)]


def main():
    fixture = {
        "source": API, "fetched_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "quantities": "4 (apparent azimuth and elevation, airless)", "height_km": HEIGHT_KM,
        "window": {"start": START, "stop": STOP, "step": STEP}, "sites": {},
    }
    for site_id in SITES:
        lat, lon = site_coords(site_id)
        entry = {"lat": lat, "lon": lon}
        for name, code in BODIES.items():
            text = query(code, lat, lon)
            entry[name] = parse(text)
            entry[f"{name}_header"] = header_notes(text)
            print(f"{site_id} {name}: {len(entry[name])} rows")
        fixture["sites"][site_id] = entry
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixture, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
