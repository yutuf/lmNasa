"""Load precomputed per-site visibility series (data/series/<site>.npz)."""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .visibility import Visibility

SERIES_DIR = Path(__file__).resolve().parent.parent / "data" / "series"


def load_series(site_id: str, series_dir: str | Path = SERIES_DIR):
    f = Path(series_dir) / f"{site_id}.npz"
    if not f.exists():
        return None, None, None
    z = np.load(f, allow_pickle=False)
    v = Visibility(
        z["times"].astype("datetime64[s]"),
        z["sun_alt"], z["sun_az"], z["sun_horizon"], z["sun_fraction"],
        z["earth_alt"], z["earth_az"], z["earth_horizon"], z["earth_visible"],
    )
    return v, float(z["step_h"]), str(z["terrain"])
