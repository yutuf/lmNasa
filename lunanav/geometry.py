"""Pure geometry helpers on a spherical Moon. No I/O, no ephemeris."""
from __future__ import annotations

import numpy as np

MOON_RADIUS_M = 1_737_400.0  # IAU mean radius used by LOLA products


def destination(lat_deg, lon_deg, azimuth_deg, distance_m, radius_m=MOON_RADIUS_M):
    """Great-circle destination point(s).

    Azimuth is measured clockwise from local north. Broadcasts over arrays.
    Returns (lat_deg, lon_deg).
    """
    lat1 = np.radians(lat_deg)
    lon1 = np.radians(lon_deg)
    az = np.radians(azimuth_deg)
    delta = np.asarray(distance_m, dtype=float) / radius_m

    sin_lat2 = np.sin(lat1) * np.cos(delta) + np.cos(lat1) * np.sin(delta) * np.cos(az)
    lat2 = np.arcsin(np.clip(sin_lat2, -1.0, 1.0))
    lon2 = lon1 + np.arctan2(
        np.sin(az) * np.sin(delta) * np.cos(lat1),
        np.cos(delta) - np.sin(lat1) * sin_lat2,
    )
    lon2 = (np.degrees(lon2) + 180.0) % 360.0 - 180.0
    return np.degrees(lat2), lon2


def distance_bearing(lat0, lon0, lat1, lon1, radius_m=MOON_RADIUS_M):
    """Great-circle distance (m) and initial bearing (deg from north, clockwise) from point 0 to 1.
    Inverse of destination(); broadcasts over arrays."""
    p0, p1 = np.radians(lat0), np.radians(lat1)
    dl = np.radians(np.asarray(lon1, float) - np.asarray(lon0, float))
    a = np.sin((p1 - p0) / 2) ** 2 + np.cos(p0) * np.cos(p1) * np.sin(dl / 2) ** 2
    d = 2 * radius_m * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))
    b = np.degrees(np.arctan2(np.sin(dl) * np.cos(p1), np.cos(p0) * np.sin(p1) - np.sin(p0) * np.cos(p1) * np.cos(dl)))
    return d, b % 360.0


def elevation_angle_deg(h_observer_m, h_target_m, distance_m, radius_m=MOON_RADIUS_M):
    """Elevation angle of a terrain point seen from the observer, with curvature.

    h_* are heights above the reference sphere; distance_m is the arc length
    along the surface. Exact for a sphere (no refraction: the Moon has no air).
    """
    theta = np.asarray(distance_m, dtype=float) / radius_m
    r_o = radius_m + np.asarray(h_observer_m, dtype=float)
    r_t = radius_m + np.asarray(h_target_m, dtype=float)
    dz = r_t * np.cos(theta) - r_o
    dx = r_t * np.sin(theta)
    return np.degrees(np.arctan2(dz, dx))


def disk_visible_fraction(center_alt_deg, horizon_alt_deg, angular_radius_deg):
    """Fraction of a disk (Sun/Earth) above a locally flat horizon line.

    Uses the exact circular-segment area for a straight horizon cut.
    """
    r = angular_radius_deg
    d = np.clip((np.asarray(center_alt_deg) - np.asarray(horizon_alt_deg)) / r, -1.0, 1.0)
    # area of circle above the chord at signed distance -d*r from center
    return (np.arccos(-d) + d * np.sqrt(1.0 - d**2)) / np.pi


def wrap_azimuth(az_deg):
    return np.asarray(az_deg) % 360.0
