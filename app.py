"""LunaNav — Streamlit app.  run:  streamlit run app.py"""

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from lunanav.metrics import MissionConstraints, evaluate_window, scan_start_dates, windows
from lunanav.power import PowerConfig, simulate_battery
from lunanav.series import load_series
from lunanav.sites import load_sites

st.set_page_config(page_title="LunaNav", page_icon="🌘", layout="wide")
st.title("LunaNav — where and when should we land?")
st.caption("Pick mission constraints. Every site × start date is scored on sunlight, "
           "Earth visibility and battery survival.")

# ---------------- sidebar: mission constraints ----------------
with st.sidebar:
    st.header("Mission")
    duration = st.slider("Surface duration (days)", 1, 30, 14)
    min_sun = st.slider("Min. sunlit time", 0, 100, 70, format="%d%%") / 100
    min_comm = st.slider("Min. Earth-in-view time", 0, 100, 50, format="%d%%") / 100
    max_dark = st.slider("Longest tolerable shadow (h)", 0, 200, 48)
    st.header("Lander (illustrative)")
    peak = st.number_input("Solar array peak (W)", 50, 5000, 400, 50)
    load = st.number_input("Average load (W)", 10, 3000, 150, 10)
    batt = st.number_input("Battery (Wh)", 100, 50_000, 2000, 100)
    min_soc = st.slider("Failure below state of charge", 0, 90, 20, format="%d%%") / 100
    stride = st.selectbox("Start-date step", [6, 12, 24], index=2, format_func=lambda h: f"{h} h")

c = MissionConstraints(duration_days=duration, min_sun_frac=min_sun, min_comm_frac=min_comm,
                       max_dark_hours=max_dark,
                       power=PowerConfig(array_peak_w=peak, load_w=load, battery_wh=batt, min_soc=min_soc))

sites = load_sites()
data = {s.id: load_series(s.id) for s in sites}
sites = [s for s in sites if data[s.id][0] is not None]
if not sites:
    st.error("No precomputed data. Run `python scripts/precompute.py` "
             "(or `python scripts/make_demo_series.py` for synthetic UI data).")
    st.stop()

terrain_labels = {data[s.id][2] for s in sites}
if any("SYNTHETIC" in t for t in terrain_labels):
    st.warning("⚠️ SYNTHETIC demo data — not real lunar geometry. Run scripts/precompute.py.")
if any(not s.verified for s in sites):
    st.info("Some site coordinates are approximate and still being verified (marked †).")


@st.cache_data(show_spinner="Scoring every site and start date…")
def scan(_c_key, site_ids):
    out = {}
    for sid in site_ids:
        v, step, _ = load_series(sid)
        out[sid] = scan_start_dates(v, step, c, start_stride_h=stride)
    return out


key = (duration, min_sun, min_comm, max_dark, peak, load, batt, min_soc, stride)
scans = scan(key, tuple(s.id for s in sites))

# ---------------- heatmap: site × start date ----------------
labels = [s.name + (" (reference)" if s.reference else "") + ("" if s.verified else " †") for s in sites]
starts = scans[sites[0].id][0]
Z = np.array([[r.score for r in scans[s.id][1]] for s in sites])
hover = np.array([[("✅ feasible" if r.meets_constraints else "❌ " + "; ".join(r.fail_reasons))
                   + f"<br>sun {r.sun_frac:.0%} · Earth {r.comm_frac:.0%} · min battery {r.min_soc:.0%}"
                   for r in scans[s.id][1]] for s in sites])
fig = go.Figure(go.Heatmap(
    z=Z, x=pd.to_datetime(starts), y=labels, customdata=hover, zmin=0, zmax=100,
    colorscale=[[0, "#3b0d0d"], [0.25, "#7a2d16"], [0.5, "#c9a227"], [1, "#2e8b57"]],
    hovertemplate="%{y}<br>start %{x|%Y-%m-%d %H:%M}<br>score %{z}<br>%{customdata}<extra></extra>",
    colorbar=dict(title="score")))
fig.update_layout(height=120 + 60 * len(sites), margin=dict(l=10, r=10, t=30, b=10),
                  title="Mission score by landing site and start date (green = go)")
st.plotly_chart(fig, width="stretch")

# best options table
rows = []
for s in sites:
    if s.reference:
        continue
    st_, res = scans[s.id]
    for t0, r in zip(st_, res):
        rows.append(dict(site=s.name, start=pd.Timestamp(t0), score=r.score, feasible=r.meets_constraints,
                         sun=r.sun_frac, earth=r.comm_frac, longest_shadow_h=r.longest_dark_h,
                         min_battery=r.min_soc))
df = pd.DataFrame(rows).sort_values("score", ascending=False)
st.subheader("Best options")
st.caption("Reference sites (e.g. Apollo 11) are shown on the heatmap for contrast but not ranked.")
st.dataframe(df.head(10).style.format({"score": "{:.1f}", "sun": "{:.0%}", "earth": "{:.0%}",
                                       "min_battery": "{:.0%}", "longest_shadow_h": "{:.0f}",
                                       "start": lambda t: t.strftime("%Y-%m-%d %H:%M")}),
             width="stretch", hide_index=True)

# ---------------- detail view ----------------
st.subheader("Inspect one option")
col1, col2 = st.columns(2)
best_idx = next(i for i, s_ in enumerate(sites) if s_.name == df.iloc[0].site)
site = sites[col1.selectbox("Site", range(len(sites)), index=best_idx, format_func=lambda i: labels[i])]
v, step, terrain = data[site.id]
start_choice = col2.select_slider("Start", options=list(pd.to_datetime(starts)),
                                  value=pd.Timestamp(df[df.site == site.name].iloc[0].start),
                                  format_func=lambda t: t.strftime("%Y-%m-%d %H:%M"))
i0 = int(np.searchsorted(v.times_utc, np.datetime64(start_choice.to_datetime64(), "s")))
sl = slice(i0, i0 + int(duration * 24 / step))
r = evaluate_window(v.sun_fraction[sl], v.sun_alt[sl], v.earth_visible[sl], step, c)
p = simulate_battery(v.sun_fraction[sl], v.sun_alt[sl], step, c.power)
tt = pd.to_datetime(v.times_utc[sl])

m = st.columns(5)
m[0].metric("Score", r.score)
m[1].metric("Sunlit", f"{r.sun_frac:.0%}")
m[2].metric("Earth in view", f"{r.comm_frac:.0%}")
m[3].metric("Longest shadow", f"{r.longest_dark_h:.0f} h")
m[4].metric("Min battery", f"{r.min_soc:.0%}", "survives" if p.survived else "FAILS",
            delta_color="normal" if p.survived else "inverse")
if r.fail_reasons:
    st.error(" · ".join(r.fail_reasons))

f2 = go.Figure()
f2.add_scatter(x=tt, y=v.sun_alt[sl], name="Sun altitude", line=dict(color="#f2b705"))
f2.add_scatter(x=tt, y=v.sun_horizon[sl], name="terrain toward Sun", line=dict(color="#f2b705", dash="dot"))
f2.add_scatter(x=tt, y=v.earth_alt[sl], name="Earth altitude", line=dict(color="#4ea8de"))
f2.add_scatter(x=tt, y=v.earth_horizon[sl], name="terrain toward Earth", line=dict(color="#4ea8de", dash="dot"))
f2.update_layout(height=320, yaxis_title="degrees above horizontal", margin=dict(t=30),
                 title="Sun and Earth vs. real terrain horizon")
st.plotly_chart(f2, width="stretch")

f3 = go.Figure()
f3.add_scatter(x=tt, y=100 * p.soc, fill="tozeroy", name="battery %", line=dict(color="#2e8b57"))
f3.add_hline(y=100 * c.power.min_soc, line_dash="dash", line_color="#c0392b", annotation_text="failure line")
f3.update_layout(height=260, yaxis=dict(title="state of charge %", range=[0, 105]), margin=dict(t=30),
                 title="Does the lander survive?")
st.plotly_chart(f3, width="stretch")

with st.expander("Earth communication windows"):
    w = windows(v.earth_visible[sl], v.times_utc[sl])
    st.table(pd.DataFrame([(pd.Timestamp(a), pd.Timestamp(b), (b - a) / np.timedelta64(1, "h"))
                           for a, b in w], columns=["from (UTC)", "to (UTC)", "hours"]))

st.caption(f"Site: {site.name} ({site.lat:.3f}°, {site.lon:.3f}°E) · source: {site.source} · "
           f"terrain: {terrain} · ephemeris: JPL DE440 via Skyfield · no atmosphere, no refraction.")
