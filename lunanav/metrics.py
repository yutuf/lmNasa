"""Mission-window metrics and scoring."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .power import PowerConfig, simulate_battery


@dataclass
class MissionConstraints:
    duration_days: float = 14.0
    min_sun_frac: float = 0.70        # fraction of mission time with >=50% solar disk
    min_comm_frac: float = 0.50       # fraction of mission time with Earth in view
    max_dark_hours: float = 48.0      # longest continuous shadow tolerated
    power: PowerConfig = field(default_factory=PowerConfig)
    weights: tuple[float, float, float] = (0.4, 0.3, 0.3)  # sun, comm, battery


@dataclass
class WindowMetrics:
    sun_frac: float
    comm_frac: float
    both_frac: float
    longest_dark_h: float
    longest_comm_gap_h: float
    min_soc: float
    survived: bool
    meets_constraints: bool
    score: float                      # 0..100
    fail_reasons: list[str]


def longest_run(mask: np.ndarray) -> int:
    """Length of the longest run of True."""
    if not mask.any():
        return 0
    padded = np.concatenate([[0], mask.astype(np.int8), [0]])
    d = np.diff(padded)
    starts, ends = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
    return int((ends - starts).max())


def windows(mask: np.ndarray, times) -> list[tuple]:
    """(start_time, end_time) for each True run; end is exclusive."""
    padded = np.concatenate([[0], mask.astype(np.int8), [0]])
    d = np.diff(padded)
    starts, ends = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
    t = np.asarray(times)
    return [(t[s], t[min(e, len(t) - 1)]) for s, e in zip(starts, ends)]


def evaluate_window(sun_fraction, sun_alt, earth_visible, step_hours: float,
                    c: MissionConstraints) -> WindowMetrics:
    lit = np.asarray(sun_fraction) >= 0.5
    comm = np.asarray(earth_visible, dtype=bool)
    sun_frac = float(lit.mean())
    comm_frac = float(comm.mean())
    both = float((lit & comm).mean())
    dark_h = longest_run(~lit) * step_hours
    gap_h = longest_run(~comm) * step_hours
    p = simulate_battery(sun_fraction, sun_alt, step_hours, c.power)

    reasons = []
    if sun_frac < c.min_sun_frac:
        reasons.append(f"sunlight {sun_frac:.0%} < {c.min_sun_frac:.0%}")
    if comm_frac < c.min_comm_frac:
        reasons.append(f"Earth in view {comm_frac:.0%} < {c.min_comm_frac:.0%}")
    if dark_h > c.max_dark_hours:
        reasons.append(f"longest shadow {dark_h:.0f} h > {c.max_dark_hours:.0f} h")
    if not p.survived:
        reasons.append(f"battery below {c.power.min_soc:.0%} at hour "
                       f"{p.first_failure_index * step_hours:.0f}")

    w_sun, w_comm, w_bat = c.weights
    soc_margin = np.clip((p.min_soc - c.power.min_soc) / (1 - c.power.min_soc), 0, 1)
    raw = w_sun * sun_frac + w_comm * comm_frac + w_bat * soc_margin
    score = 100 * raw / sum(c.weights)
    if reasons:
        score *= 0.25  # infeasible windows sink to the bottom but keep their ordering
    return WindowMetrics(sun_frac, comm_frac, both, dark_h, gap_h, p.min_soc,
                         p.survived, not reasons, round(float(score), 1), reasons)


def scan_start_dates(vis, step_hours: float, c: MissionConstraints, start_stride_h: float = 24.0):
    """Slide a mission window over a precomputed visibility series.

    Returns (start_times, list[WindowMetrics]). vis must cover the last start + duration.
    """
    n_win = int(round(c.duration_days * 24 / step_hours))
    stride = max(1, int(round(start_stride_h / step_hours)))
    starts, results = [], []
    for i in range(0, len(vis.times_utc) - n_win + 1, stride):
        sl = slice(i, i + n_win)
        starts.append(vis.times_utc[i])
        results.append(evaluate_window(vis.sun_fraction[sl], vis.sun_alt[sl],
                                       vis.earth_visible[sl], step_hours, c))
    return np.array(starts), results
