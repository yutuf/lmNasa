"""Battery state-of-charge simulation.

Illustrative lander, NOT any specific mission. All numbers are user-editable
assumptions shown in the UI:

- Two-axis sun-tracking solar array: output = peak x visible solar-disk
  fraction. Valid at the pole (Sun near horizon) and at the equator alike.
- Constant electrical load (avionics + survival heaters lumped together).
- Ideal battery with charge/discharge efficiency, clamped to [0, capacity].
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class PowerConfig:
    array_peak_w: float = 400.0       # array output at full Sun, normal incidence
    load_w: float = 150.0             # average continuous load
    battery_wh: float = 2_000.0       # usable capacity
    initial_soc: float = 1.0          # 0..1 at mission start
    charge_eff: float = 0.95
    discharge_eff: float = 0.95
    min_soc: float = 0.2              # below this the mission is considered failed


@dataclass
class PowerResult:
    soc: np.ndarray                   # 0..1 per timestep (end of step)
    array_w: np.ndarray
    min_soc: float
    survived: bool
    first_failure_index: int | None


def simulate_battery(sun_fraction, sun_alt_deg, step_hours: float, cfg: PowerConfig) -> PowerResult:
    sun_fraction = np.asarray(sun_fraction, dtype=float)
    array_w = cfg.array_peak_w * sun_fraction  # sun_alt_deg kept in the API for future panel models

    energy = cfg.initial_soc * cfg.battery_wh
    soc = np.empty_like(array_w)
    for i, p in enumerate(array_w):
        net = (p - cfg.load_w) * step_hours
        energy += net * cfg.charge_eff if net > 0 else net / cfg.discharge_eff
        energy = min(max(energy, 0.0), cfg.battery_wh)
        soc[i] = energy / cfg.battery_wh

    below = np.flatnonzero(soc < cfg.min_soc)
    first = int(below[0]) if below.size else None
    return PowerResult(soc, array_w, float(soc.min()) if soc.size else cfg.initial_soc,
                       first is None, first)
