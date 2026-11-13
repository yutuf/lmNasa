"""Shadow casting on synthetic terrain, and the committed patches."""
import numpy as np
import pytest

from lunanav.terrain3d import TERRAIN_DIR, load_patch, shadow_mask, sun_vector


def test_wall_casts_a_shadow_away_from_the_sun():
    z = np.zeros((41, 41))
    z[:, 25] = 100.0                                   # a 100 m wall running north-south, east of centre
    sun = np.array([np.cos(np.radians(5)), 0.0, np.sin(np.radians(5))])   # Sun low in the +x direction
    s = shadow_mask(z, 100.0, sun)
    # a 100 m wall throws a shadow 100 / tan(5 deg) = 1143 m long: about 11 cells of 100 m
    assert s[20, 15:24].all() and not s[20, 10]
    assert not s[20, 26:].any()                        # the sunny side stays lit


def test_flat_ground_is_lit_and_high_sun_casts_little():
    z = np.zeros((21, 21))
    assert not shadow_mask(z, 100.0, sun_vector(0.0, 90.0, 1.0)).any()
    z[10, 10] = 50.0
    assert shadow_mask(z, 100.0, sun_vector(0.0, 90.0, 80.0)).sum() == 0


def test_sun_vector_points_east_at_azimuth_90_on_the_zero_meridian():
    v = sun_vector(0.0, 90.0, 0.0)                     # at lon 0, local east is +x
    assert v == pytest.approx([1.0, 0.0, 0.0], abs=1e-9)
    v = sun_vector(0.0, 0.0, 0.0)                      # local north points away from the pole: +y at lon 0
    assert v == pytest.approx([0.0, 1.0, 0.0], abs=1e-9)


@pytest.mark.skipif(not any(TERRAIN_DIR.glob("*.npz")), reason="no terrain patches")
def test_committed_patches_are_square_and_centred():
    for f in TERRAIN_DIR.glob("*.npz"):
        z, x, y, spacing = load_patch(f.stem)
        assert z.shape[0] == z.shape[1] == len(x) == len(y)
        assert abs(x[len(x) // 2]) < 1e-6 and spacing == 160.0
