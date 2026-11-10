"""Sun and Earth topocentric alt/az for a point on the Moon (Skyfield + NAIF).

Kernels (put them in data/kernels/, they are downloaded by scripts/fetch_kernels.py):
  de421.bsp                       planetary ephemeris
  moon_080317.tf                  Moon frames (MOON_ME_DE421)
  pck00008.tpc                    planetary constants
  moon_pa_de421_1900-2050.bpc     Moon orientation (libration) for de421

Moon has no atmosphere: we use astrometric positions (no refraction).
Altitude is relative to the local *geometric* horizon (sphere tangent plane).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

KERNEL_DIR = Path(__file__).resolve().parent.parent / "data" / "kernels"
SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6_371.0


@dataclass
class SkyTrack:
    times_utc: np.ndarray      # numpy datetime64[s]
    sun_alt: np.ndarray        # deg
    sun_az: np.ndarray         # deg, clockwise from lunar north
    sun_radius: np.ndarray     # angular radius, deg
    earth_alt: np.ndarray
    earth_az: np.ndarray
    earth_radius: np.ndarray


class MoonSky:
    def __init__(self, kernel_dir: str | Path = KERNEL_DIR):
        from skyfield.api import Loader
        from skyfield.planetarylib import PlanetaryConstants

        load = Loader(str(kernel_dir))
        self.ts = load.timescale()
        self.eph = load("de421.bsp")
        pc = PlanetaryConstants()
        pc.read_text(load("moon_080317.tf"))
        pc.read_text(load("pck00008.tpc"))
        pc.read_binary(load("moon_pa_de421_1900-2050.bpc"))
        self.pc = pc
        self.frame = pc.build_frame_named("MOON_ME_DE421")
        self.moon = self.eph["moon"]
        self.sun = self.eph["sun"]
        self.earth = self.eph["earth"]

    def times(self, start_utc: str, end_utc: str, step_hours: float = 1.0):
        start = np.datetime64(start_utc, "s")
        end = np.datetime64(end_utc, "s")
        step = np.timedelta64(int(step_hours * 3600), "s")
        dts = np.arange(start, end, step)
        return dts, self.ts.utc(*_split_dt64(dts))

    def track(self, lat: float, lon: float, start_utc: str, end_utc: str,
              step_hours: float = 1.0, height_m: float = 0.0) -> SkyTrack:
        dts, t = self.times(start_utc, end_utc, step_hours)
        place = self.moon + self.pc.build_latlon_degrees(self.frame, lat, lon, elevation_m=height_m)
        obs = place.at(t)
        out = {}
        for name, body, radius in (("sun", self.sun, SUN_RADIUS_KM), ("earth", self.earth, EARTH_RADIUS_KM)):
            alt, az, dist = obs.observe(body).altaz()
            out[name] = (alt.degrees, az.degrees, np.degrees(np.arcsin(radius / dist.km)))
        return SkyTrack(dts, *out["sun"], *out["earth"])


def _split_dt64(dts):
    """datetime64[s] array -> (year, month, day, hour, minute, second) arrays for ts.utc."""
    y = dts.astype("datetime64[Y]").astype(int) + 1970
    m = dts.astype("datetime64[M]").astype(int) % 12 + 1
    d = (dts - dts.astype("datetime64[M]")).astype("timedelta64[D]").astype(int) + 1
    secs = (dts - dts.astype("datetime64[D]")).astype("timedelta64[s]").astype(int)
    return y, m, d, secs // 3600, (secs % 3600) // 60, secs % 60
