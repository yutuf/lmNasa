"""Terrain horizon profiles from a LOLA DEM.

Offline step: the DEM is only needed to build horizon profiles
(360 floats per site). The app never loads the DEM.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path

import numpy as np

from .geometry import destination, elevation_angle_deg

MOON_LONGLAT = "+proj=longlat +R=1737400 +no_defs +type=crs"


@dataclass
class HorizonProfile:
    site_id: str
    lat: float
    lon: float
    azimuths_deg: list[float]   # clockwise from local north
    elevations_deg: list[float]  # terrain horizon elevation at each azimuth
    observer_height_m: float
    max_distance_m: float
    source: str

    def at(self, az_deg):
        """Horizon elevation at arbitrary azimuth(s), periodic interpolation."""
        az = np.asarray(self.azimuths_deg, dtype=float)
        el = np.asarray(self.elevations_deg, dtype=float)
        return np.interp(np.asarray(az_deg) % 360.0, az, el, period=360.0)

    def to_dict(self):
        return asdict(self)

    @classmethod
    def from_dict(cls, d):
        return cls(**d)

    @classmethod
    def flat(cls, site_id, lat, lon, n=360):
        az = np.linspace(0, 360, n, endpoint=False)
        return cls(site_id, lat, lon, az.tolist(), [0.0] * n, 0.0, 0.0, "flat (no terrain)")


def compute_horizon(
    sample_height,  # callable(lat_deg_array, lon_deg_array) -> height_m array (NaN outside DEM)
    site_id: str,
    lat: float,
    lon: float,
    n_azimuths: int = 360,
    step_m: float = 120.0,
    max_distance_m: float = 150_000.0,
    observer_height_m: float = 2.0,
    min_distance_m: float = 300.0,
    source: str = "",
) -> HorizonProfile:
    """Ray-march outward along great circles; horizon = max elevation angle.

    min_distance_m skips the observer's own cell (avoids DEM-noise spikes).
    """
    az = np.linspace(0.0, 360.0, n_azimuths, endpoint=False)
    dist = np.arange(min_distance_m, max_distance_m + step_m, step_m)
    AZ, D = np.meshgrid(az, dist, indexing="ij")  # (n_az, n_dist)
    lat_r, lon_r = destination(lat, lon, AZ, D)

    h_site = float(sample_height(np.array([lat]), np.array([lon]))[0])
    if not np.isfinite(h_site):
        raise ValueError(f"{site_id}: site is outside the DEM coverage")
    h = sample_height(lat_r.ravel(), lon_r.ravel()).reshape(AZ.shape)

    elev = elevation_angle_deg(h_site + observer_height_m, h, D)
    elev = np.where(np.isfinite(elev), elev, -90.0)
    horizon = elev.max(axis=1)
    return HorizonProfile(site_id, lat, lon, az.tolist(), horizon.round(4).tolist(),
                          observer_height_m, max_distance_m, source)


def dem_sampler(dem_path: str | Path):
    """Bilinear DEM sampler in lunar lat/lon, using the raster's own CRS.

    Works with LOLA polar-stereographic GeoTIFFs (heights in meters relative
    to the 1737.4 km sphere). Returns NaN outside coverage / nodata.
    """
    import rasterio
    from pyproj import CRS, Transformer

    src = rasterio.open(dem_path)
    band = src.read(1, masked=True).astype("float64").filled(np.nan)
    scale = src.scales[0] if src.scales else 1.0
    offset = src.offsets[0] if src.offsets else 0.0
    band = band * scale + offset
    to_xy = Transformer.from_crs(CRS.from_proj4(MOON_LONGLAT), src.crs, always_xy=True)
    inv = ~src.transform

    def sample(lat_deg, lon_deg):
        x, y = to_xy.transform(np.asarray(lon_deg), np.asarray(lat_deg))
        x, y = np.asarray(x), np.asarray(y)
        col = inv.a * x + inv.b * y + inv.c      # explicit affine: works with every `affine` version
        row = inv.d * x + inv.e * y + inv.f
        col = col - 0.5
        row = row - 0.5
        c0 = np.floor(col).astype(int)
        r0 = np.floor(row).astype(int)
        fc = col - c0
        fr = row - r0
        H, W = band.shape
        ok = (c0 >= 0) & (r0 >= 0) & (c0 + 1 < W) & (r0 + 1 < H)
        out = np.full(np.shape(col), np.nan)
        c0o, r0o, fco, fro = c0[ok], r0[ok], fc[ok], fr[ok]
        out[ok] = (
            band[r0o, c0o] * (1 - fco) * (1 - fro)
            + band[r0o, c0o + 1] * fco * (1 - fro)
            + band[r0o + 1, c0o] * (1 - fco) * fro
            + band[r0o + 1, c0o + 1] * fco * fro
        )
        return out

    return sample


def save_profiles(profiles: list[HorizonProfile], path: str | Path):
    Path(path).write_text(json.dumps([p.to_dict() for p in profiles], indent=1))


def load_profiles(path: str | Path) -> dict[str, HorizonProfile]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return {d["site_id"]: HorizonProfile.from_dict(d) for d in data}
