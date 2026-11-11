"""LunaNav — Streamlit app.  run:  streamlit run app.py"""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from pathlib import Path

from lunanav.horizon import HorizonProfile, load_profiles
from lunanav.metrics import (MissionConstraints, delay_tolerance, evaluate_window, hours_until_change,
                             scan_start_dates, windows)
from lunanav.panorama import break_at_wraps, circular_mean_deg, compass_ticks, unwrap_about
from lunanav.power import PowerConfig, required_battery_wh, simulate_battery
from lunanav.series import load_series
from lunanav.sites import load_sites

HORIZONS = Path(__file__).resolve().parent / "data" / "horizons.json"
REGION_OUTLINES = HORIZONS.with_name("artemis_regions.json")   # scripts/artemis_regions.py --outlines


@st.cache_resource
def region_outlines():
    import json
    return json.loads(REGION_OUTLINES.read_text()) if REGION_OUTLINES.exists() else None


@st.cache_resource
def horizons():
    return load_profiles(HORIZONS) if HORIZONS.exists() else {}


def fmt_hours(h):
    return f"{h:.0f} h" if h < 48 else f"{h / 24:.1f} days"


def until(mask, i, step, verb_on, verb_off):
    """'sets in 3.2 days' / 'rises in 5 h' / 'does not set before the data ends'."""
    h = hours_until_change(mask, i, step)
    verb = verb_on if mask[i] else verb_off
    return f"does not {verb} before the data ends" if h is None else f"{verb}s in {fmt_hours(h)}"

st.set_page_config(page_title="LunaNav", page_icon="🌘", layout="wide")
st.title("LunaNav — where and when should we land?")
st.caption("Pick mission constraints. Every site × start date is scored on sunlight, "
           "Earth visibility and battery survival.")

with st.expander("New here? How to read this page (2 min)"):
    st.markdown("""
**The question:** a solar-powered lander near the Moon's south pole needs two things — **sunlight** for power and
**Earth in the sky** to talk to mission control. Near the pole the Sun never rises high: it crawls around the horizon
once a month, so a hill a few hundred metres tall can put the lander in shadow for days. Earth hangs low too and
wobbles a little (libration), so it also slips behind hills.

**What LunaNav does:** for each landing site it uses NASA's laser-altimeter terrain (LOLA) to work out the real horizon
in every direction, and JPL's planetary ephemeris (DE440) to know where the Sun and Earth are, hour by hour, until 2028.

**How to use it**
1. Set the mission in the sidebar (how long on the surface, how much sun and Earth contact you need, battery size).
2. The **heatmap** colours every site × landing date: bright yellow = all requirements met, dark blue = not (colour-blind-safe scale).
3. **Best options** gives the best landing date for each site. *delay_ok_days* = how many days the launch could
   slip and still be fine.
4. **Inspect one option** shows the 360° view from the lander, a time slider ("what does the lander see on day 5?"),
   when the Sun and Earth will next set, and whether the battery survives.

**Cited vs derived points:** *cited* sites come from publications: a published point, or the centre of an
official Artemis III region (USGS grid). The source is shown at the bottom.
A *derived* point is LunaNav's own pick: the best spot within 1 km of a cited site with a gentle slope. For the
Artemis III regions there can also be a *best in region* point: the best spot anywhere inside the official region.
Both are always labelled and never replace the cited site.
""")

# ---------------- shareable state: the URL encodes the whole scenario ----------------
# key: (default, min, max). Seeded from the URL once per session; widgets then own the value.
SETTINGS = {"days": (14, 1, 30), "sun": (70, 0, 100), "earth": (50, 0, 100), "shadow": (48, 0, 200),
            "peak": (400, 50, 5000), "load": (150, 10, 3000), "batt": (2000, 100, 50_000), "fail": (20, 0, 90),
            "step": (24, 6, 24), "derived": (1, 0, 1)}
for k, (dflt, lo_, hi_) in SETTINGS.items():
    if k not in st.session_state:
        try:
            val = min(max(int(st.query_params.get(k, dflt)), lo_), hi_)
        except (TypeError, ValueError):
            val = dflt
        if k == "step" and val not in (6, 12, 24):
            val = dflt
        st.session_state[k] = bool(val) if k == "derived" else val

# ---------------- sidebar: mission constraints ----------------
with st.sidebar:
    st.header("Mission")
    duration = st.slider("Surface duration (days)", 1, 30, key="days")
    min_sun = st.slider("Min. sunlit time", 0, 100, format="%d%%", key="sun") / 100
    min_comm = st.slider("Min. Earth-in-view time", 0, 100, format="%d%%", key="earth") / 100
    max_dark = st.slider("Longest tolerable shadow (h)", 0, 200, key="shadow")
    st.header("Lander (illustrative)")
    peak = st.number_input("Solar array peak (W)", 50, 5000, step=50, key="peak")
    load = st.number_input("Average load (W)", 10, 3000, step=10, key="load")
    batt = st.number_input("Battery (Wh)", 100, 50_000, step=100, key="batt")
    min_soc = st.slider("Failure below state of charge", 0, 90, format="%d%%", key="fail") / 100
    stride = st.selectbox("Start-date step", [6, 12, 24], format_func=lambda h: f"{h} h", key="step",
                          help="How finely landing dates are sampled. 6 h is finer but slower.")
    show_derived = any(s.derived for s in load_sites()) and st.toggle(
        "Show derived best points", key="derived",
        help="LunaNav's own picks: the best spot within 1 km of each cited site and, for Artemis III regions, "
             "the best spot inside the whole region. Most hours with Sun and Earth both in view, slope ≤ 10°. "
             "Computed, not published.")
    st.caption("🔗 The page address always holds the current scenario (settings, site, start date): "
               "copy it from the browser to share exactly this view.")

c = MissionConstraints(duration_days=duration, min_sun_frac=min_sun, min_comm_frac=min_comm,
                       max_dark_hours=max_dark,
                       power=PowerConfig(array_peak_w=peak, load_w=load, battery_wh=batt, min_soc=min_soc))

sites = load_sites()
if not show_derived:
    sites = [s for s in sites if not s.derived]
by_id = {s.id: s for s in load_sites()}
data = {s.id: load_series(s.id) for s in sites}
pending = [s.name for s in sites if data[s.id][0] is None]
sites = [s for s in sites if data[s.id][0] is not None]
if not sites:
    st.error("No precomputed data. Run `python scripts/precompute.py` "
             "(or `python scripts/make_demo_series.py` for synthetic UI data).")
    st.stop()

terrain_labels = {data[s.id][2] for s in sites}
if any("SYNTHETIC" in t for t in terrain_labels):
    st.warning("⚠️ SYNTHETIC demo data — not real lunar geometry. Run scripts/precompute.py.")
if pending:
    st.caption(f"⏳ Defined but not computed yet (run the offline scripts): {', '.join(pending)}.")
if any(not s.verified and not s.derived for s in sites):
    st.info("Some site coordinates are approximate and still being verified (marked †).")


@st.cache_data(show_spinner="Scoring start dates…", max_entries=256)
def scan_site(settings: tuple, site_id: str):
    """One site, one set of settings. Pure in its (hashed) arguments, so any sidebar change recomputes,
    and adding/toggling sites only computes the new ones.
    (Never prefix an argument with "_" here: Streamlit leaves those out of the cache key.)"""
    duration_, min_sun_, min_comm_, max_dark_, peak_, load_, batt_, min_soc_, stride_ = settings
    cc = MissionConstraints(duration_days=duration_, min_sun_frac=min_sun_, min_comm_frac=min_comm_,
                            max_dark_hours=max_dark_,
                            power=PowerConfig(array_peak_w=peak_, load_w=load_, battery_wh=batt_, min_soc=min_soc_))
    v_, step_, _ = load_series(site_id)
    return scan_start_dates(v_, step_, cc, start_stride_h=stride_)


settings = (duration, min_sun, min_comm, max_dark, peak, load, batt, min_soc, stride)
scans = {s.id: scan_site(settings, s.id) for s in sites}

# ---------------- heatmap: site × start date ----------------
COMPASS8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
MAX_SLOPE = 10.0   # landing-slope limit used for derived points (scripts/derive_best_points.py --max-slope)


def site_label(s):
    if s.derived:
        d = COMPASS8[int(((s.bearing_deg or 0) + 22.5) // 45) % 8]
        parent = by_id[s.derived_from].name.split(' (')[0]
        if s.search == "region":
            return f"↳ best in region: {s.distance_m / 1000:.1f} km {d} of {parent}"
        return f"↳ derived: {s.distance_m:.0f} m {d} of {parent}"
    steep = f" ⚠ {s.slope_deg:.1f}° slope" if s.slope_deg is not None and s.slope_deg > MAX_SLOPE else ""
    return s.name + (" (reference)" if s.reference else "") + ("" if s.verified else " †") + steep


labels = [site_label(s) for s in sites]
starts = scans[sites[0].id][0]
Z = np.array([[r.score for r in scans[s.id][1]] for s in sites])
hover = np.array([[("✅ feasible" if r.meets_constraints else "❌ " + "; ".join(r.fail_reasons))
                   + f"<br>sun {r.sun_frac:.0%} · Earth {r.comm_frac:.0%} · min battery {r.min_soc:.0%}"
                   for r in scans[s.id][1]] for s in sites])
fig = go.Figure(go.Heatmap(
    z=Z, x=pd.to_datetime(starts), y=labels, customdata=hover, zmin=0, zmax=100,
    colorscale="Cividis",  # colour-blind-safe
    hovertemplate="%{y}<br>start %{x|%Y-%m-%d %H:%M}<br>score %{z}<br>%{customdata}<extra></extra>",
    colorbar=dict(title="score")))
fig.update_layout(height=140 + 32 * len(sites), margin=dict(l=10, r=10, t=30, b=10),
                  yaxis=dict(autorange="reversed"),   # same top-to-bottom order as the site list
                  title="Mission score by landing site and start date (bright = go)")
st.plotly_chart(fig, width="stretch")

with st.expander("Map: where are these sites around the south pole?"):
    polar = [s for s in sites if s.lat < -80]
    rho = lambda s: np.radians(90 + s.lat) * 1737.4  # noqa: E731  km from the pole (azimuthal equidistant)
    mp = go.Figure()

    def label_pos(pts):
        """Above the marker by default (below near the pole). Two sites within 20 km get side labels:
        the one further out sideways is labelled on its outer side, the other on the opposite side."""
        xy = [(rho(s) * np.sin(np.radians(s.lon)), rho(s) * np.cos(np.radians(s.lon))) for s in pts]
        pos = ["bottom center" if rho(s) < 25 else "top center" for s in pts]
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                if np.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]) < 20:
                    o, n = (i, j) if abs(xy[i][0]) > abs(xy[j][0]) else (j, i)
                    out_side = "right" if xy[o][0] > 0 else "left"
                    pos[o] = f"middle {out_side}"
                    pos[n] = "middle " + ("left" if out_side == "right" else "right")
        return pos

    for ring in (50, 100, 150, 200):
        th = np.linspace(0, 2 * np.pi, 181)
        mp.add_scatter(x=ring * np.sin(th), y=ring * np.cos(th), mode="lines", hoverinfo="skip",
                       line=dict(color="#2a3550", width=1), showlegend=False)
        mp.add_annotation(x=0, y=-ring, text=f"{ring} km", showarrow=False, font=dict(color="#7f8aa3", size=10))
    kinds = {"cited": lambda s: not s.derived, "derived (≤ 1 km)": lambda s: s.derived and s.search != "region",
             "best in region": lambda s: s.search == "region"}
    for kind, color, sym in (("cited", "#f2b705", "circle"), ("derived (≤ 1 km)", "#4ea8de", "diamond"),
                             ("best in region", "#7ee081", "star")):
        pts = [s for s in polar if kinds[kind](s)]
        if pts:
            mp.add_scatter(x=[rho(s) * np.sin(np.radians(s.lon)) for s in pts],
                           y=[rho(s) * np.cos(np.radians(s.lon)) for s in pts],
                           mode="markers+text" if kind == "cited" else "markers", name=kind,
                           text=[s.name.split(" (")[0] for s in pts],
                           textposition=label_pos(pts),
                           textfont=dict(color="#dfe6f3", size=11),
                           marker=dict(size=11 if kind == "cited" else 8, color=color, symbol=sym),
                           hovertext=[f"{labels[sites.index(s)]}<br>{s.lat:.4f}°, {s.lon:.4f}°E" for s in pts],
                           hoverinfo="text")
    ro = region_outlines()
    if ro:
        xs, ys, tx = [], [], []
        for r in ro["regions"].values():
            for line in r["lines"]:
                la = np.array([p[0] for p in line]); lo = np.array([p[1] for p in line])  # noqa: E702
                rr = np.radians(90 + la) * 1737.4
                xs += list(rr * np.sin(np.radians(lo))) + [None]
                ys += list(rr * np.cos(np.radians(lo))) + [None]
                tx += [f"{r['name']} — Artemis III region, {r['area_km2']} km²"] * len(line) + [None]
        mp.add_scatter(x=xs, y=ys, mode="lines", name="Artemis III regions (USGS)", text=tx, hoverinfo="text",
                       line=dict(color="#6b8f71", width=1.5))
    mp.add_scatter(x=[0], y=[0], mode="markers+text", text=["South Pole"], textposition="middle right",
                   marker=dict(symbol="x", size=9, color="white"), textfont=dict(color="white"), showlegend=False)
    mp.add_annotation(x=0, y=212, text="↑ 0° E — toward Earth (near side)", showarrow=False,
                      font=dict(color="#4ea8de"))
    mp.update_layout(height=600, plot_bgcolor="#0b1020", margin=dict(t=20, b=10),
                     xaxis=dict(visible=False, range=[-222, 222]),
                     yaxis=dict(visible=False, range=[-222, 222], scaleanchor="x"),
                     legend=dict(orientation="h", y=-0.02))
    st.plotly_chart(mp, width="stretch")
    st.caption("Distances from the pole, true to scale. Green outlines: NASA's Artemis III candidate regions "
               "(USGS navigation grids, McClernan 2024). Derived points sit within 1 km of their cited site, "
               "so they overlap it at this scale. Longitude 0° faces Earth, which is why sites on that side "
               "see Earth more often." + ("" if len(polar) == len(sites) else
                                            " Apollo 11 (equator) is off this map."))

# best options table
rows = []
for s in sites:
    if s.reference:
        continue
    st_, res = scans[s.id]
    slack = delay_tolerance([r.meets_constraints for r in res], stride)
    for t0, r, sl_h in zip(st_, res, slack):
        rows.append(dict(site=labels[sites.index(s)], point="derived" if s.derived else "cited",
                         start=pd.Timestamp(t0), slope_deg=s.slope_deg, score=r.score, feasible=r.meets_constraints,
                         delay_ok_days=sl_h / 24 if sl_h >= 0 else np.nan,
                         sun=r.sun_frac, earth=r.comm_frac, longest_shadow_h=r.longest_dark_h,
                         min_battery=r.min_soc))
df = pd.DataFrame(rows).sort_values(["feasible", "score", "delay_ok_days"], ascending=False)
st.subheader("Best options")
st.caption("Best landing date for each site. **delay_ok_days** = how many days the launch can slip and every "
           "later start is still feasible (breaks ties in score). Reference sites (e.g. Apollo 11) are shown on "
           "the heatmap but not ranked.")
FMT = {"score": "{:.1f}", "sun": "{:.0%}", "earth": "{:.0%}", "min_battery": "{:.0%}", "longest_shadow_h": "{:.0f}",
       "delay_ok_days": "{:.0f}", "slope_deg": lambda x: "–" if pd.isna(x) else f"{x:.1f}°",
       "start": lambda t: t.strftime("%Y-%m-%d %H:%M")}
st.dataframe(df.groupby("site", sort=False).head(1).style.format(FMT), width="stretch", hide_index=True)
with st.expander("Top 20 site × date options overall"):
    st.dataframe(df.head(20).style.format(FMT), width="stretch", hide_index=True)

# ---------------- detail view ----------------
st.subheader("Inspect one option")
col1, col2 = st.columns(2)
ids = [s_.id for s_ in sites]
url_site = st.query_params.get("site")
site_idx = ids.index(url_site) if url_site in ids else labels.index(df.iloc[0].site)
site = sites[col1.selectbox("Site", range(len(sites)), index=site_idx, format_func=lambda i: labels[i])]
v, step, terrain = data[site.id]
start_opts = list(pd.to_datetime(starts))
site_rows = df[df.site == labels[sites.index(site)]]
start_default = pd.Timestamp(site_rows.iloc[0].start) if len(site_rows) else start_opts[0]
try:   # keep the URL's start date only while the URL still points at this site
    url_start = pd.Timestamp(st.query_params.get("start", ""))
    if url_site == site.id and url_start in start_opts:
        start_default = url_start
except ValueError:
    pass
start_choice = col2.select_slider("Start", options=start_opts, value=start_default,
                                  format_func=lambda t: t.strftime("%Y-%m-%d %H:%M"))
st.query_params.from_dict({**{k: str(int(st.session_state[k])) for k in SETTINGS},
                           "site": site.id, "start": start_choice.strftime("%Y-%m-%dT%H:%M")})
i0 = int(np.searchsorted(v.times_utc, np.datetime64(start_choice.to_datetime64(), "s")))
sl = slice(i0, i0 + int(duration * 24 / step))
r = evaluate_window(v.sun_fraction[sl], v.sun_alt[sl], v.earth_visible[sl], step, c)
p = simulate_battery(v.sun_fraction[sl], v.sun_alt[sl], step, c.power)
tt = pd.to_datetime(v.times_utc[sl])
n_steps = len(tt)

if site.slope_deg is not None and site.slope_deg > MAX_SLOPE:
    st.warning(f"⚠ **Steep at the cited point:** the LOLA 40 m terrain gives a {site.slope_deg:.1f}° slope here, "
               f"above the {MAX_SLOPE:.0f}° limit LunaNav uses for landing. The point is kept exactly as cited "
               f"(it marks a region, not a surveyed landing spot); the sunlight and Earth numbers are still valid "
               f"for this point, but a lander would need a flatter spot nearby.")
if site.derived:
    st.info(f"**Derived point.** {site.note} "
            f"Slope here {site.slope_deg:.1f}° (cited point {site.cited_slope_deg:.1f}°).")
else:
    both = lambda vv, k=slice(None): float(((vv.sun_fraction[k] >= .5) & vv.earth_visible[k]).mean())  # noqa: E731
    for sib in (d for d in sites if d.derived_from == site.id):
        sv = data[sib.id][0]
        where = (f"the best point inside this Artemis III region, {sib.distance_m / 1000:.1f} km away"
                 if sib.search == "region" else f"a derived point {sib.distance_m:.0f} m away")
        st.caption(f"💡 LunaNav found {where} (slope {sib.slope_deg:.1f}°). "
                   f"Hours with Sun **and** Earth in view — this mission: {both(v, sl):.0%} here vs "
                   f"{both(sv, sl):.0%} there; whole 2026–2028 period: {both(v):.0%} vs {both(sv):.0%}. "
                   f"Pick “{labels[sites.index(sib)]}” above to inspect it.")

m = st.columns(5)
m[0].metric("Score", r.score)
m[1].metric("Sunlit", f"{r.sun_frac:.0%}", help="Share of mission hours with at least half the Sun's disk above the terrain.")
m[2].metric("Earth in view", f"{r.comm_frac:.0%}", help="Share of mission hours with Earth above the terrain: direct-to-Earth radio is possible.")
m[3].metric("Longest shadow", f"{r.longest_dark_h:.0f} h", help="Longest continuous stretch without usable sunlight.")
m[4].metric("Min battery", f"{r.min_soc:.0%}", "survives" if p.survived else "FAILS",
            delta_color="normal" if p.survived else "inverse")
need_wh = required_battery_wh(v.sun_fraction[sl], step, c.power)
w_sun, w_comm, w_batt = c.weights
margin = max(0.0, (r.min_soc - c.power.min_soc) / (1 - c.power.min_soc)) if c.power.min_soc < 1 else 0.0
st.caption(
    ("🔋 **Battery needed for this mission:** none — the array covers the load the whole time. "
     if need_wh == 0 else
     f"🔋 **Battery needed for this mission:** {need_wh:,.0f} Wh to stay above the {c.power.min_soc:.0%} failure line "
     f"(you set {batt:,} Wh{' — enough' if need_wh <= batt else ' — too small'}; array {peak} W, load {load} W). ")
    + f"· **Score** = 100 × ({w_sun}×sunlit {r.sun_frac:.2f} + {w_comm}×Earth {r.comm_frac:.2f} + "
    f"{w_batt}×battery margin {margin:.2f})" + ("" if r.meets_constraints else " × 0.25 (a requirement failed)")
    + f" = {r.score:.1f}")
end_t = tt[-1] + pd.Timedelta(hours=step)
if r.meets_constraints:
    st.success(f"✅ **GO** — landing {start_choice:%d %b %Y %H:%M} UTC and staying {duration} days (until "
               f"{end_t:%d %b %Y}), the lander has usable sunlight {r.sun_frac:.0%} of the time, can talk to Earth "
               f"{r.comm_frac:.0%} of the time, and its battery never drops below {r.min_soc:.0%}.")
else:
    st.error(f"❌ **NO-GO** for {duration} days from {start_choice:%d %b %Y %H:%M} UTC — "
             + " · ".join(r.fail_reasons))

# ---- time cursor: "what does the lander see at this moment?" ----
cur_h = st.slider("Moment in the mission (hours after landing)", 0.0, (n_steps - 1) * step, 0.0, step,
                  format="%.0f h",
                  help="Move through the mission to see where the Sun and Earth are, and how long until they set.")
cur = int(round(cur_h / step))
gi = i0 + cur
lit_mask = v.sun_fraction >= 0.5
now = tt[cur]
sun_txt = (f"☀️ **Sun:** {v.sun_fraction[gi]:.0%} of the disk above the terrain — "
           + until(lit_mask, gi, step, "set", "rise"))
earth_txt = ("🌍 **Earth:** " + ("in view" if v.earth_visible[gi] else "behind terrain") + " — "
             + until(v.earth_visible, gi, step, "set", "rise"))
st.markdown(f"**{now:%Y-%m-%d %H:%M} UTC** (day {cur * step / 24:.1f})  \n{sun_txt}  \n{earth_txt}")

# ---- 360° panorama ----
hz = horizons().get(site.id) or HorizonProfile.flat(site.id, site.lat, site.lon)
center = circular_mean_deg(v.earth_az[sl])
lo, hi = center - 180.0, center + 180.0
xg = np.linspace(lo, hi, 721)
terr = hz.at(xg % 360.0)
sx = unwrap_about(v.sun_az[sl], center)
ex = unwrap_about(v.earth_az[sl], center)
y_lo = max(-6.0, min(-2.0, terr.min() - 1, v.earth_alt[sl].min() - 1))
y_hi = max(terr.max(), v.earth_alt[sl].max(), min(v.sun_alt[sl].max(), 90)) + 2
pan = go.Figure()
pan.add_scatter(x=np.r_[lo, xg, hi], y=np.r_[y_lo - 50, terr, y_lo - 50], fill="toself", mode="lines",
                line=dict(color="#8d8d8d", width=1), fillcolor="#4a4a4a", name="terrain horizon",
                hovertemplate="az %{x:.0f}° · terrain %{y:.2f}°<extra></extra>")
bx, by = break_at_wraps(sx, v.sun_alt[sl])
pan.add_scatter(x=bx, y=by, mode="lines", line=dict(color="#f2b705", width=2), name="Sun path",
                hovertemplate="Sun az %{x:.0f}° alt %{y:.2f}°<extra></extra>")
bx, by = break_at_wraps(ex, v.earth_alt[sl])
pan.add_scatter(x=bx, y=by, mode="lines", line=dict(color="#4ea8de", width=2), name="Earth path",
                hovertemplate="Earth az %{x:.0f}° alt %{y:.2f}°<extra></extra>")
pan.add_scatter(x=[sx[cur]], y=[v.sun_alt[gi]], mode="markers", name="Sun now",
                marker=dict(size=18, color="#ffd23f", line=dict(color="white", width=1)))
pan.add_scatter(x=[ex[cur]], y=[v.earth_alt[gi]], mode="markers", name="Earth now",
                marker=dict(size=16, color="#1f77b4", line=dict(color="white", width=1)))
tv, tl = compass_ticks(lo, hi)
pan.update_layout(height=340, margin=dict(t=40, b=10), plot_bgcolor="#0b1020",
                  title="360° view from the lander: terrain horizon, Sun and Earth paths over the mission",
                  xaxis=dict(range=[lo, hi], tickvals=tv, ticktext=tl, showgrid=False, title="direction"),
                  yaxis=dict(range=[y_lo, y_hi], title="degrees above horizontal", gridcolor="#1e2a44"),
                  legend=dict(orientation="h", y=-0.25))
st.plotly_chart(pan, width="stretch")
st.caption("Vertical scale is exaggerated. Near the pole the Sun circles the horizon once a month and "
           "Earth wobbles in a small loop (libration), so a hill a few degrees high decides everything. "
           "Terrain: " + hz.source)

f2 = go.Figure()
f2.add_scatter(x=tt, y=v.sun_alt[sl], name="Sun altitude", line=dict(color="#f2b705"))
f2.add_scatter(x=tt, y=v.sun_horizon[sl], name="terrain toward Sun", line=dict(color="#f2b705", dash="dot"))
f2.add_scatter(x=tt, y=v.earth_alt[sl], name="Earth altitude", line=dict(color="#4ea8de"))
f2.add_scatter(x=tt, y=v.earth_horizon[sl], name="terrain toward Earth", line=dict(color="#4ea8de", dash="dot"))
f2.add_vline(x=now, line_color="#888", line_dash="dash")
f2.update_layout(height=320, yaxis_title="degrees above horizontal", margin=dict(t=30),
                 title="Over time: is the Sun / Earth above the terrain? (line above dotted = visible)")
st.plotly_chart(f2, width="stretch")

f3 = go.Figure()
f3.add_scatter(x=tt, y=100 * p.soc, fill="tozeroy", name="battery %", line=dict(color="#2e8b57"))
f3.add_hline(y=100 * c.power.min_soc, line_dash="dash", line_color="#c0392b", annotation_text="failure line")
f3.add_vline(x=now, line_color="#888", line_dash="dash")
f3.update_layout(height=260, yaxis=dict(title="state of charge %", range=[0, 105]), margin=dict(t=30),
                 title="Does the lander survive?")
st.plotly_chart(f3, width="stretch")

with st.expander("Earth communication windows"):
    w = windows(v.earth_visible[sl], v.times_utc[sl])
    st.table(pd.DataFrame([(pd.Timestamp(a), pd.Timestamp(b), (b - a) / np.timedelta64(1, "h"))
                           for a, b in w], columns=["from (UTC)", "to (UTC)", "hours"]))

timeline = pd.DataFrame({
    "sun_alt_deg": v.sun_alt[sl], "sun_az_deg": v.sun_az[sl],
    "terrain_toward_sun_deg": v.sun_horizon[sl], "sun_disk_visible": v.sun_fraction[sl],
    "earth_alt_deg": v.earth_alt[sl], "earth_az_deg": v.earth_az[sl],
    "terrain_toward_earth_deg": v.earth_horizon[sl], "earth_in_view": v.earth_visible[sl],
    "array_w": p.array_w, "battery_soc": p.soc}).round(4)
timeline.insert(0, "time_utc", tt)
st.download_button("⬇ Download this mission timeline (CSV, hourly)", timeline.to_csv(index=False).encode(),
                   file_name=f"lunanav_{site.id}_{start_choice:%Y%m%d_%H%M}.csv", mime="text/csv",
                   help="Every hour of the selected mission: Sun/Earth position, terrain, visibility, battery.")

with st.expander("Assumptions & limits (read before quoting a number)"):
    st.markdown("""
- **Geometry is real, the lander is not.** Sun/Earth positions: JPL DE440 + NAIF Moon frames, cross-checked against
  JPL Horizons (~0.0001°). Terrain: LOLA south-pole DEM, 40 m/pixel, horizon ray-marched to 150 km from a 2 m mast.
  The power model (two-axis tracking array, constant load, 95 % efficiencies) is **illustrative**, not any real mission.
- **No atmosphere, so no refraction.** Spherical Moon (R = 1737.4 km) with the DEM on top.
- **"Sunlit"** = at least half the solar disk above the terrain; **"Earth in view"** = Earth's centre above the terrain.
  No antenna pattern, no relay satellites, no thermal model.
- **Slope** comes from the 40 m DEM; boulders and small craters (metre scale) are invisible at that resolution.
- **Derived and best-in-region points** are LunaNav's computation, not published coordinates. "Best in region"
  searches the USGS region grid on a coarse grid (~1,500 points) refined to 100 m around the top 5, so a
  better spot between grid points can exist.
- Data window: Nov 2026 – Dec 2028, hourly.
""")

st.caption(f"Site: {labels[sites.index(site)]} ({site.lat:.4f}°, {site.lon:.4f}°E) · source: {site.source} · "
           f"terrain: {terrain} · ephemeris: JPL DE440 via Skyfield · no atmosphere, no refraction.")
