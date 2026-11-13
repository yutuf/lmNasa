"""Deep Space Network visibility of the Moon (data/dsn.npz, written by scripts/precompute_dsn.py)."""
from __future__ import annotations

from pathlib import Path

import numpy as np

DSN_FILE = Path(__file__).resolve().parent.parent / "data" / "dsn.npz"
DEFAULT_MASK_DEG = 10.0   # minimum Moon elevation at a DSN complex for a usable link (assumption, editable)


class DSN:
    def __init__(self, times_unix: np.ndarray, stations: list[str], elevation_deg: np.ndarray):
        self.times = times_unix
        self.stations = stations
        self.elevation_deg = elevation_deg          # (stations, times)

    @classmethod
    def load(cls, path: str | Path = DSN_FILE) -> "DSN | None":
        p = Path(path)
        if not p.exists():
            return None
        z = np.load(p, allow_pickle=False)
        return cls(z["times"].astype(np.int64), [str(s) for s in z["stations"]], z["moon_elevation_deg"])

    def any_in_view(self, times_utc: np.ndarray, mask_deg: float = DEFAULT_MASK_DEG) -> np.ndarray:
        """True where at least one complex sees the Moon above the mask, for the given datetime64 times."""
        unix = np.asarray(times_utc).astype("datetime64[s]").astype(np.int64)
        idx = np.searchsorted(self.times, unix)
        idx = np.clip(idx, 0, len(self.times) - 1)
        ok = (self.elevation_deg[:, idx] > mask_deg).any(axis=0)
        return ok & (self.times[idx] == unix)
