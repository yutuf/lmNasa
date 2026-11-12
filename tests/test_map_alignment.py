"""scripts/check_map_alignment.py finds a known registration offset between two synthetic maps."""
import importlib.util
from pathlib import Path

import numpy as np
import pytest

rasterio = pytest.importorskip("rasterio")
pyproj = pytest.importorskip("pyproj")
ROOT = Path(__file__).resolve().parent.parent
CRS = pyproj.CRS.from_proj4("+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs")


def _field(X, Y):
    """Smooth hills plus narrow ridges: something a 60 m offset visibly changes."""
    return (0.5 + 0.25 * np.sin(X / 2500.0) * np.cos(Y / 1900.0)
            + 0.2 * np.exp(-((X % 4000) - 2000) ** 2 / 150.0 ** 2))


def _write(path, res, half, shift=(0.0, 0.0)):
    from rasterio.transform import from_origin
    n = int(2 * half / res)
    c = -half + res * (np.arange(n) + 0.5)
    X, Y = np.meshgrid(c, -c)
    Z = _field(X - shift[0], Y - shift[1])          # map content displaced by `shift`
    with rasterio.open(path, "w", driver="GTiff", height=n, width=n, count=1, dtype="int16", crs=CRS,
                       transform=from_origin(-half, half, res, res)) as d:
        d.write(np.round(Z / 4e-5).astype("int16"), 1)
        d.scales, d.offsets = (4e-5,), (0.0,)
    return path


def _run(tmp_path, shift):
    spec = importlib.util.spec_from_file_location("al", ROOT / "scripts" / "check_map_alignment.py")
    al = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(al)
    coarse = _write(tmp_path / "c.tif", 120.0, 60_000.0)
    fine = _write(tmp_path / "f.tif", 60.0, 40_000.0, shift)
    return al.main([str(coarse), str(fine), "--lat-min", "-89.9", "--lat-max", "-88.8", "--max-shift", "120",
                    "--step", "60", "--n", "400"])


def test_registered_maps_give_zero_shift(tmp_path):
    out = _run(tmp_path, (0.0, 0.0))
    assert out["best_shift_m"] == (0.0, 0.0) and out["rms_zero"] < 0.01 and out["registered"]


def test_offset_map_is_detected(tmp_path):
    out = _run(tmp_path, (60.0, -120.0))              # fine map content displaced 60 m E, 120 m S
    assert out["best_shift_m"] == (-60.0, 120.0)      # shifting it back lines it up
    assert out["rms_best"] < out["rms_zero"] / 2   # residual: coarse map = point values, compared to block means
    assert not out["registered"]


def test_half_pixel_best_shift_with_no_gain_counts_as_registered(tmp_path):
    """The real 120 m vs 60 m NASA maps gave best shift (0, -30) m with the same RMS as at zero:
    half a fine pixel, below the method's resolution. That must not be reported as an offset."""
    out = _run(tmp_path, (0.0, -30.0))
    assert out["registered"]
