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


def simulate_battery_batch(sun_fraction_2d, step_hours: float, cfg: PowerConfig) -> list[PowerResult]:
    """Same model as simulate_battery, run for many windows at once.

    sun_fraction_2d has shape (n_windows, n_steps). Loops over time only,
    so cost is n_steps numpy ops instead of n_windows * n_steps Python steps.
    """
    sf = np.atleast_2d(np.asarray(sun_fraction_2d, dtype=float))
    array_w = cfg.array_peak_w * sf
    energy = np.full(sf.shape[0], cfg.initial_soc * cfg.battery_wh)
    soc = np.empty_like(array_w)
    for j in range(sf.shape[1]):
        net = (array_w[:, j] - cfg.load_w) * step_hours
        energy = energy + np.where(net > 0, net * cfg.charge_eff, net / cfg.discharge_eff)
        energy = np.clip(energy, 0.0, cfg.battery_wh)
        soc[:, j] = energy / cfg.battery_wh
    out = []
    for k in range(sf.shape[0]):
        below = np.flatnonzero(soc[k] < cfg.min_soc)
        first = int(below[0]) if below.size else None
        out.append(PowerResult(soc[k], array_w[k], float(soc[k].min()) if soc.shape[1] else cfg.initial_soc,
                               first is None, first))
    return out
