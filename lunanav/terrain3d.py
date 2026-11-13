"""Cast shadows on a small terrain patch for the simple view's 3D scene.

The patch (data/terrain/<site>.npz, scripts/make_terrain_patches.py) is a square grid in the south-polar
stereographic plane centred on the site. Shadows are computed in the site's tangent plane: heights are
lowered by d^2 / 2R for the Moon's curvature, the Sun's direction is the same for every point (its rays are
parallel), and a point is in shadow when terrain between it and the edge of the patch rises above the ray
toward the Sun. Terrain beyond the patch is not included, so a point lit here can still be shadowed by a
distant ridge; the verdict and the animation use the full 150 km horizon instead.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np

R_MOON_M = 1_737_400.0
TERRAIN_DIR = Path(__file__).resolve().parent.parent / "data" / "terrain"


def load_patch(site_id: str, folder: Path = TERRAIN_DIR):
    f = Path(folder) / f"{site_id}.npz"
    if not f.exists():
        return None
    z = np.load(f, allow_pickle=False)
    return z["heights_m"].astype(np.float64), z["x_km"].astype(np.float64), z["y_km"].astype(np.float64), float(z["spacing_m"])


def sun_vector(site_lon_deg: float, az_deg: float, alt_deg: float) -> np.ndarray:
    """Unit vector toward the Sun in patch coordinates (x east-ish, y toward lon 0, z up) for a site at a
    given longitude near the south pole. Local north points away from the pole, east is clockwise from it."""
    lon, az, alt = (math.radians(a) for a in (site_lon_deg, az_deg, alt_deg))
    north = np.array([math.sin(lon), math.cos(lon)])
    east = np.array([math.cos(lon), -math.sin(lon)])
    d = math.cos(az) * north + math.sin(az) * east
    return np.array([math.cos(alt) * d[0], math.cos(alt) * d[1], math.sin(alt)])


def curvature_corrected(z: np.ndarray, x_km: np.ndarray, y_km: np.ndarray) -> np.ndarray:
    X, Y = np.meshgrid(x_km * 1000.0, y_km * 1000.0)
    return z - (X ** 2 + Y ** 2) / (2.0 * R_MOON_M)


def shadow_mask(z: np.ndarray, spacing_m: float, sun: np.ndarray) -> np.ndarray:
    """True where a grid point is in shadow. z rows run from +y (top) to -y (bottom), columns from -x to +x."""
    horiz = math.hypot(sun[0], sun[1])
    if horiz < 1e-9:
        return np.zeros_like(z, dtype=bool)
    dx, dy = sun[0] / horiz, sun[1] / horiz          # unit step toward the Sun in the plane
    rise = sun[2] / horiz * spacing_m                 # ray climb per grid step
    n_r, n_c = z.shape
    rows, cols = np.mgrid[0:n_r, 0:n_c]
    shadow = np.zeros_like(z, dtype=bool)
    for k in range(1, int(math.hypot(n_r, n_c)) + 1):
        r = np.rint(rows - k * dy).astype(int)        # +y is up the page, i.e. toward row 0
        c = np.rint(cols + k * dx).astype(int)
        inside = (r >= 0) & (r < n_r) & (c >= 0) & (c < n_c)
        if not inside.any():
            break
        blocked = np.zeros_like(shadow)
        blocked[inside] = z[r[inside], c[inside]] > z[inside] + k * rise
        shadow |= blocked
    return shadow


def shade(z: np.ndarray, spacing_m: float, sun: np.ndarray, shadow: np.ndarray) -> np.ndarray:
    """Brightness 0..1 for display: lit ground from 0.3 (barely lit) to 1 (facing the Sun), cast shadow 0.03.

    With the Sun a degree or two up, real lit ground is only a few percent as bright as ground facing the Sun;
    the scale is stretched so lit and shadowed ground stay easy to tell apart on screen."""
    gy, gx = np.gradient(z, spacing_m)
    normal = np.dstack([-gx, gy, np.ones_like(z)])     # gy sign: rows run toward -y
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    lambert = np.clip(normal @ sun, 0.0, 1.0)
    top = lambert[~shadow].max() if (~shadow).any() else 1.0
    rel = np.sqrt(lambert / top) if top > 0 else lambert
    return np.where(shadow | (lambert <= 0), 0.03, 0.3 + 0.7 * rel)
