# LunaNav — where and when should we land on the Moon?

NASA Space Apps Challenge 2026 · *Lunar Landing Site Navigator*

Existing tools (QuickMap, Moon Trek, JPL Horizons) are built for detailed analysis.
Answering a simple planning question — *"at this south-pole site, on which dates do we
have Sun and Earth in view, and does the lander survive the night?"* — takes many steps
and expert knowledge. LunaNav answers it in one screen:

- **Score heatmap:** every candidate site × every start date, green = go.
- **Real terrain horizon:** Sun and Earth are compared against the actual LOLA horizon, not a flat one.
- **Battery survival:** a transparent lander power model shows *when* a mission would die.
- **Communication windows:** when Earth is above the terrain.

## How it works

```
offline (needs kernels + DEM)                           runtime (Streamlit, light)
──────────────────────────────                          ──────────────────────────
LOLA south-pole DEM ──► build_horizons.py ──► data/horizons.json ─┐
                                                                  ├─► precompute.py ──► data/series/<site>.npz ──► app.py
NAIF kernels (DE440 + Moon frames) ──► lunanav.ephemeris ─────────┘                         (scoring, battery, plots)
```

The app never touches the DEM or the kernels, so it deploys anywhere (Streamlit Community Cloud).

| module | job |
|---|---|
| `lunanav/geometry.py` | great-circle steps, elevation angle with lunar curvature, visible disk fraction |
| `lunanav/horizon.py` | ray-march DEM → 360° horizon profile per site |
| `lunanav/ephemeris.py` | Skyfield: Sun/Earth alt-az from a point in the Moon's ME frame (with libration) |
| `lunanav/visibility.py` | Sun disk fraction above terrain, Earth above terrain |
| `lunanav/power.py` | battery state-of-charge simulation |
| `lunanav/metrics.py` | window metrics, constraints, score, sliding start-date scan |
| `app.py` | Streamlit UI |

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[offline,dev]"
pytest -q

# real data
python scripts/fetch_kernels.py                          # ~130 MB (DE440)
python scripts/build_horizons.py data/dem/<lola_south_pole>.tif
python scripts/precompute.py --start 2027-01-01 --end 2028-01-01

# or synthetic data just to work on the UI
python scripts/make_demo_series.py

streamlit run app.py
```

## Scoring

For one site and one start date, over the mission duration (1 h steps):

- **sunlit** = share of hours with ≥ 50 % of the solar disk above terrain
- **Earth in view** = share of hours with Earth's center above terrain
- **longest shadow** = longest continuous run of non-sunlit hours
- **battery margin** = (min state of charge − failure line) / (1 − failure line)

`score = 100 × (0.4·sunlit + 0.3·Earth + 0.3·battery margin)`.
If any constraint fails (min sunlit, min Earth, max shadow, battery), the score is ×0.25 and the
reasons are listed. Weights and constraints are editable.

## Assumptions (stated, not hidden)

- No atmosphere → no refraction. Altitudes are geometric.
- Spherical Moon, R = 1737.4 km (LOLA reference); terrain from the DEM on top of it.
- Horizon from a 2 m mast, ray-marched to 150 km. Terrain closer than 300 m is ignored (DEM noise).
- Sun disk fraction uses a straight horizon cut across the disk.
- Power: two-axis sun-tracking array (output = peak × visible disk fraction), constant load,
  95 % charge/discharge efficiency. **Illustrative lander, not any real mission.**
- Earth visibility uses Earth's center; no antenna pattern or relay satellites.
- Site coordinates marked † are approximate and must be verified against the cited source.

## License

See `LICENSE`.
