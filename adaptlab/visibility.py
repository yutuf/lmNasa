"""Combine a sky track with a terrain horizon -> per-timestep visibility."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .geometry import disk_visible_fraction
from .horizon import HorizonProfile


@dataclass
class Visibility:
    times_utc: np.ndarray
    sun_alt: np.ndarray
    sun_az: np.ndarray
    sun_horizon: np.ndarray      # terrain elevation in the Sun's direction
    sun_fraction: np.ndarray     # 0..1 of solar disk above terrain
    earth_alt: np.ndarray
    earth_az: np.ndarray
    earth_horizon: np.ndarray
    earth_visible: np.ndarray    # bool, Earth center above terrain + margin


def compute_visibility(track, horizon: HorizonProfile, earth_margin_deg: float = 0.0) -> Visibility:
    sun_h = horizon.at(track.sun_az)
    earth_h = horizon.at(track.earth_az)
    sun_frac = disk_visible_fraction(track.sun_alt, sun_h, track.sun_radius)
    earth_vis = track.earth_alt > earth_h + earth_margin_deg
    return Visibility(track.times_utc, track.sun_alt, track.sun_az, sun_h, sun_frac,
                      track.earth_alt, track.earth_az, earth_h, earth_vis)
