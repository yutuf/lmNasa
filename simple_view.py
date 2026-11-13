"""The judge-first "simple view": one question, five spots, a big verdict and an animation.

Rendered at the top of app.py. It reuses the same data, mission settings and models as the planner
below it, but shows only what a non-expert needs: GO or NO-GO, why, and the Sun sliding along the
real horizon.
"""
from __future__ import annotations

import html
import math

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from lunanav.dsn import DEFAULT_MASK_DEG, DSN
from lunanav.horizon import HorizonProfile
from lunanav.metrics import MissionConstraints, evaluate_window
from lunanav.power import required_battery_wh, simulate_battery
from lunanav.series import load_series
from lunanav.terrain3d import curvature_corrected, load_patch, shade, shadow_mask, sun_vector

# (site id, button label, one-line description shown under the buttons)
SPOTS = [
    ("malapert_massif", "Malapert: published spot",
     "Malapert Massif, the point NASA lists for this Artemis III region (86°S)."),
    ("malapert_massif_derived", "Malapert: 447 m away",
     "Less than half a kilometre from the published spot, on the same mountain."),
    ("malapert_massif_region_best", "Malapert: 5 km away",
     "The best spot LunaNav found inside the same Artemis III region, 5 km west."),
    ("shackleton_ridge", "Shackleton ridge",
     "A ridge 60 km from the pole, one of the best-lit places on the Moon."),
    ("apollo_11", "Apollo 11 (equator)",
     "Tranquility Base, for comparison: at the equator, day and night each last two weeks."),
]
DEFAULT_SPOT, DEFAULT_DATE = "malapert_massif", "2027-09-09"
GOOD, BAD = "#1f9d55", "#d64545"
SUN, EARTH, GREY = "#f2b705", "#4ea8de", "#6b7280"


@st.cache_resource
def _series(site_id):
    return load_series(site_id)


@st.cache_resource
def _sites():
    from lunanav.sites import load_sites
    return load_sites()


@st.cache_resource
def _dsn():
    return DSN.load()


def _verdict(site_id: str, start: pd.Timestamp, c: MissionConstraints):
    """GO / NO-GO for one spot and landing date, or None when the window runs past the data."""
    v, step, _ = _series(site_id)
    i0 = int(np.searchsorted(v.times_utc, np.datetime64(start.to_datetime64(), "s")))
    n = int(c.duration_days * 24 / step)
    if i0 + n > len(v.times_utc):
        return None
    sl = slice(i0, i0 + n)
    p = simulate_battery(v.sun_fraction[sl], v.sun_alt[sl], step, c.power)
    return evaluate_window(v.sun_fraction[sl], v.sun_alt[sl], v.earth_visible[sl], step, c, p)


def _chip(label: str, r) -> str:
    if r is None:
        colour, word = GREY, "no data"
    else:
        colour, word = (GOOD, "GO") if r.meets_constraints else (BAD, "NO-GO")
    return (f"<div style='flex:1;min-width:150px;border-radius:12px;padding:10px 12px;background:{colour};"
            f"color:#ffffff'><div style='font-size:13px;opacity:.9'>{html.escape(label)}</div>"
            f"<div style='font-size:22px;font-weight:800'>{word}</div></div>")


def _hours(h: float) -> str:
    return f"{h:.0f} hours" if h < 48 else f"{h / 24:.1f} days"


def _why(r, p, c: MissionConstraints, step: float) -> str:
    """One or two plain sentences for the verdict."""
    if r.meets_constraints:
        return (f"The lander has sunlight {r.sun_frac:.0%} of the time and can talk to Earth "
                f"{r.comm_frac:.0%} of the time. Its battery never runs low.")
    parts = []
    if not p.survived:
        hour = p.first_failure_index * step if p.first_failure_index is not None else None
        when = f" after {_hours(hour)}" if hour is not None else ""
        parts.append(f"The battery runs flat{when}: there is no sunlight for up to "
                     f"{_hours(r.longest_dark_h)} in a row.")
    elif r.longest_dark_h > c.max_dark_hours:
        parts.append(f"There is no sunlight for {_hours(r.longest_dark_h)} in a row.")
    if r.sun_frac < c.min_sun_frac:
        parts.append(f"Sunlight only {r.sun_frac:.0%} of the time.")
    if r.comm_frac < c.min_comm_frac:
        parts.append(f"Earth is below the horizon {1 - r.comm_frac:.0%} of the time, so no direct radio link then.")
    return " ".join(parts) or "One of the mission requirements is not met."


def _tile(icon: str, title: str, value: str, note: str, ok: bool) -> str:
    colour = GOOD if ok else BAD
    return (f"<div style='flex:1;min-width:180px;border:1px solid {colour};border-radius:14px;padding:14px 16px'>"
            f"<div style='font-size:15px;opacity:.8'>{icon} {html.escape(title)}</div>"
            f"<div style='font-size:34px;font-weight:700;color:{colour};line-height:1.2'>{html.escape(value)}</div>"
            f"<div style='font-size:14px;opacity:.75'>{html.escape(note)}</div></div>")


def _day_strip(v, sl, step: float, link=None) -> str:
    """One square per mission day: yellow = share of hours with the Sun up, blue = with Earth up,
    green = with Earth up and a DSN dish facing the Moon (when `link` is given)."""
    sun = (v.sun_fraction[sl] >= 0.5).astype(float)
    earth = v.earth_visible[sl].astype(float)
    per_day = int(round(24 / step))
    n_days = len(sun) // per_day
    cells = []
    rows = [("sun", sun, "242,183,5", "☀️ Sun up"), ("earth", earth, "78,168,222", "🌍 Earth up")]
    if link is not None:
        rows.append(("link", link.astype(float), "52,199,89", "📡 Radio link"))
    for row, vals, rgb, label in rows:
        squares = []
        for d in range(n_days):
            share = float(vals[d * per_day:(d + 1) * per_day].mean())
            squares.append(f"<div title='Day {d + 1}: {share:.0%} of the hours' style='flex:1;height:26px;"
                           f"border-radius:5px;background:rgba({rgb},{0.08 + 0.92 * share:.2f})'></div>")
        cells.append(f"<div style='display:flex;align-items:center;gap:4px'><div style='width:110px;"
                     f"font-size:14px'>{label}</div>{''.join(squares)}</div>")
    days = "".join(f"<div style='flex:1;text-align:center;font-size:12px;opacity:.6'>{d + 1}</div>"
                   for d in range(n_days))
    return ("<div style='display:flex;flex-direction:column;gap:5px'>" + "".join(cells)
            + f"<div style='display:flex;gap:4px'><div style='width:110px;font-size:12px;opacity:.6'>day</div>"
            f"{days}</div></div>")


def _animation(v, sl, step: float, hz: HorizonProfile, start: pd.Timestamp) -> go.Figure:
    """The view from the lander, played hour by hour: terrain silhouette, Sun and Earth."""
    az_t = np.asarray(hz.azimuths_deg, float)
    el_t = np.asarray(hz.elevations_deg, float)
    order = np.argsort(az_t)
    az_t, el_t = np.append(az_t[order], 360.0), np.append(el_t[order], el_t[order][0])

    s_az, s_alt = v.sun_az[sl].astype(float), v.sun_alt[sl].astype(float)
    e_az, e_alt = v.earth_az[sl].astype(float), v.earth_alt[sl].astype(float)
    s_up, e_up = v.sun_fraction[sl] >= 0.5, v.earth_visible[sl]
    stride = max(1, int(round(2 / step)))            # a frame every 2 hours
    idx = list(range(0, len(s_az), stride))

    y_lo = min(-3.0, float(el_t.min()) - 1, float(np.nanmin(e_alt)) - 1)
    y_hi = min(90.0, max(float(el_t.max()), float(np.nanmax(s_alt)), float(np.nanmax(e_alt)), 5.0) + 2)

    def caption(k):
        t = start + pd.Timedelta(hours=k * step)
        sun = "Sun up" if s_up[k] else "Sun HIDDEN behind the terrain"
        earth = "Earth in view" if e_up[k] else "Earth hidden"
        return f"Day {k * step / 24 + 1:.0f}, {t:%d %b %H:%M} UTC: {sun} · {earth}"

    def markers(k):
        return [
            go.Scatter(x=[s_az[k]], y=[s_alt[k]], mode="markers+text", text=["Sun" if s_up[k] else "Sun (hidden)"],
                       textposition="top center", textfont=dict(size=15, color=SUN if s_up[k] else GREY),
                       marker=dict(size=30, color=SUN if s_up[k] else GREY, line=dict(width=2, color="#ffffff")),
                       name="Sun"),
            go.Scatter(x=[e_az[k]], y=[e_alt[k]], mode="markers+text",
                       text=["Earth" if e_up[k] else "Earth (hidden)"], textposition="bottom right",
                       textfont=dict(size=15, color=EARTH if e_up[k] else GREY),
                       marker=dict(size=20, color=EARTH if e_up[k] else GREY, line=dict(width=2, color="#ffffff")),
                       name="Earth"),
        ]

    fig = go.Figure(
        data=[
            go.Scatter(x=[0, 360], y=[y_lo, y_lo], mode="lines", line=dict(width=0), hoverinfo="skip",
                       showlegend=False),
            go.Scatter(x=az_t, y=el_t, fill="tonexty", mode="lines", line=dict(color="#b8bcc6", width=1.5),
                       fillcolor="rgba(120,120,130,0.75)", name="terrain", hoverinfo="skip"),
            go.Scatter(x=s_az, y=s_alt, mode="markers", marker=dict(size=3, color="rgba(242,183,5,0.35)"),
                       name="Sun's path", hoverinfo="skip"),
            *markers(0),
        ],
        frames=[go.Frame(data=markers(k), traces=[3, 4], name=str(k),
                         layout=go.Layout(title=dict(text=caption(k)))) for k in idx],
    )
    fig.update_layout(
        title=dict(text=caption(0), font=dict(size=18)), height=430, showlegend=False,
        margin=dict(l=40, r=20, t=60, b=40), plot_bgcolor="#0b1020",
        xaxis=dict(range=[0, 360], tickvals=[0, 45, 90, 135, 180, 225, 270, 315, 360],
                   ticktext=["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"], title="direction you are facing",
                   showgrid=False),
        yaxis=dict(range=[y_lo, y_hi], title="height above the horizon (°)", zeroline=False, showgrid=False),
        updatemenus=[dict(type="buttons", x=0.0, y=-0.14, xanchor="left", direction="left", bgcolor="#f2b705",
                          bordercolor="#f2b705", font=dict(color="#111111", size=14), buttons=[
            dict(label="▶ Play the mission", method="animate",
                 args=[None, dict(frame=dict(duration=120, redraw=True), fromcurrent=True, transition=dict(duration=0))]),
            dict(label="⏸ Pause", method="animate",
                 args=[[None], dict(frame=dict(duration=0, redraw=False), mode="immediate")]),
        ])],
    )
    return fig


@st.cache_resource
def _patch(site_id):
    p = load_patch(site_id)
    if p is None:
        return None
    z, x, y, spacing = p
    return z, x, y, spacing, curvature_corrected(z, x, y)


def _scene(site_id: str, lon: float, sun_az: float, sun_alt: float, earth_az: float, earth_alt: float,
           sun_up: bool, title: str) -> go.Figure | None:
    """3D terrain around the lander, lit and shadowed by the Sun at one moment."""
    p = _patch(site_id)
    if p is None:
        return None
    z, x, y, spacing, zc = p
    sun = sun_vector(lon, sun_az, sun_alt)
    light = shade(zc, spacing, sun, shadow_mask(zc, spacing, sun))
    if not sun_up:                                   # hidden by terrain beyond the patch: show the site dark too
        n = len(x) // 2
        light[n - 2:n + 3, n - 2:n + 3] = np.minimum(light[n - 2:n + 3, n - 2:n + 3], 0.04)
    n = len(x) // 2
    site_z = z[n, n]
    span = (x[-1] - x[0]) * 1000.0
    fig = go.Figure(go.Surface(
        x=x, y=y, z=z, surfacecolor=light, cmin=0, cmax=1, showscale=False, hoverinfo="skip",
        colorscale=[[0, "#020205"], [0.3, "#4a4b52"], [1, "#fbf6e6"]],
        lighting=dict(ambient=1.0, diffuse=0.0, specular=0.0, roughness=1.0)))
    for az, alt, colour, name in ((sun_az, sun_alt, SUN, "to the Sun"), (earth_az, earth_alt, EARTH, "to Earth")):
        d = sun_vector(lon, az, alt) * 9.0
        fig.add_scatter3d(x=[0, d[0]], y=[0, d[1]], z=[site_z, site_z + d[2] * 1000.0], mode="lines+text",
                          text=["", name], line=dict(color=colour, width=7), textfont=dict(color=colour, size=14),
                          hoverinfo="skip", showlegend=False)
    fig.add_scatter3d(x=[0], y=[0], z=[site_z + 150], mode="markers+text", text=["lander"],
                      marker=dict(size=7, color="#ff4b4b"), textfont=dict(color="#ffffff", size=14),
                      hoverinfo="skip", showlegend=False)
    relief = float(z.max() - z.min())
    h = math.hypot(sun[0], sun[1]) or 1.0           # camera on the Sun's side, 40 deg off, so lit slopes face us
    a = math.atan2(sun[1] / h, sun[0] / h) + math.radians(40)
    eye = dict(x=1.5 * math.cos(a), y=1.5 * math.sin(a), z=0.95)
    fig.update_layout(
        title=dict(text=title, font=dict(size=16)), height=520, margin=dict(l=0, r=0, t=40, b=0),
        scene=dict(xaxis=dict(visible=False), yaxis=dict(visible=False), zaxis=dict(visible=False),
                   aspectmode="manual", aspectratio=dict(x=1, y=1, z=min(0.6, 3 * relief / span)),
                   camera=dict(eye=eye), bgcolor="#05060a"))
    return fig


def render(c: MissionConstraints, horizons: dict) -> None:
    st.markdown("## Can a solar lander survive here?")
    st.markdown("A lander near the Moon's south pole needs **sunlight** for power and **Earth in the sky** to "
                "talk home. Near the pole the Sun never climbs high: it circles the horizon, so a hill a few "
                "hundred metres away can hide it for days. Pick a spot and a landing date.")

    ids = [s for s, *_ in SPOTS]
    url_site = st.query_params.get("site")
    default = url_site if url_site in ids else DEFAULT_SPOT
    labels = {s: label for s, label, _ in SPOTS}
    spot = st.segmented_control("Landing spot", ids, default=default, format_func=labels.get, key="simple_spot")
    spot = spot or default
    st.caption(next(d for s, _, d in SPOTS if s == spot))

    v, step, _ = _series(spot)
    first, last = pd.Timestamp(v.times_utc[0]), pd.Timestamp(v.times_utc[-1])
    try:
        url_day = pd.Timestamp(st.query_params.get("start", DEFAULT_DATE)).normalize()
    except ValueError:
        url_day = pd.Timestamp(DEFAULT_DATE)
    span = pd.Timedelta(days=c.duration_days)
    day = st.date_input("Landing date", value=min(max(url_day, first), last - span).date(),
                        min_value=first.date(), max_value=(last - span).date(), key="simple_date")
    start = pd.Timestamp(day)

    i0 = int(np.searchsorted(v.times_utc, np.datetime64(start.to_datetime64(), "s")))
    sl = slice(i0, i0 + int(c.duration_days * 24 / step))
    r = evaluate_window(v.sun_fraction[sl], v.sun_alt[sl], v.earth_visible[sl], step, c)
    p = simulate_battery(v.sun_fraction[sl], v.sun_alt[sl], step, c.power)
    need = required_battery_wh(v.sun_fraction[sl], step, c.power)

    ok = r.meets_constraints
    colour, word = (GOOD, "GO") if ok else (BAD, "NO-GO")
    st.markdown(
        f"<div style='border-radius:16px;padding:18px 24px;background:{colour};color:#ffffff;margin:8px 0 14px'>"
        f"<div style='font-size:52px;font-weight:800;line-height:1'>{word}</div>"
        f"<div style='font-size:19px;margin-top:8px'>{html.escape(_why(r, p, c, step))}</div>"
        f"<div style='font-size:14px;opacity:.85;margin-top:6px'>{c.duration_days:g}-day mission from "
        f"{start:%d %B %Y}</div></div>", unsafe_allow_html=True)

    hour_fail = p.first_failure_index * step if p.first_failure_index is not None else None
    battery_value = "Lasts" if p.survived else f"Dies after {_hours(hour_fail)}" if hour_fail else "Dies"
    battery_note = ("no battery needed: the panels cover it" if need == 0 else
                    f"a {need:,.0f} Wh battery would be enough" if not p.survived else
                    f"{c.power.battery_wh:,.0f} Wh battery is enough")
    dsn = _dsn()
    link = (v.earth_visible[sl] & dsn.any_in_view(v.times_utc[sl])) if dsn else None
    earth_note = (f"with a NASA dish facing the Moon too: {link.mean():.0%}" if link is not None
                  else "of the mission")
    st.markdown(
        "<div style='display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px'>"
        + _tile("☀️", "Sunlight", f"{r.sun_frac:.0%}", "of the mission", r.sun_frac >= c.min_sun_frac)
        + _tile("🌍", "Earth in the sky", f"{r.comm_frac:.0%}", earth_note, r.comm_frac >= c.min_comm_frac)
        + _tile("🔋", "Battery", battery_value, battery_note, p.survived)
        + "</div>", unsafe_allow_html=True)

    st.markdown("**Day by day** (brighter = more hours)")
    st.markdown(_day_strip(v, sl, step, link), unsafe_allow_html=True)
    if link is not None:
        st.caption(f"📡 A radio link needs Earth above the lander's horizon **and** one of NASA's Deep Space Network "
                   f"dishes (Goldstone, Madrid, Canberra) seeing the Moon at least {DEFAULT_MASK_DEG:.0f}° above "
                   "its own horizon.")

    labels_ = dict((s, label) for s, label, _ in SPOTS)
    st.markdown("**If the launch slips** (same spot)")
    st.markdown("<div style='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px'>" + "".join(
        _chip(name, _verdict(spot, start + pd.Timedelta(days=d), c))
        for name, d in (("On time", 0), ("1 day late", 1), ("1 week late", 7), ("2 weeks late", 14),
                        ("1 month late", 30))) + "</div>", unsafe_allow_html=True)
    st.markdown(f"**Same date, other spots** ({start:%d %B %Y})")
    st.markdown("<div style='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px'>" + "".join(
        _chip(labels_[s], _verdict(s, start, c)) for s in labels_) + "</div>", unsafe_allow_html=True)

    st.markdown("**What the lander sees** — press ▶ to play the mission")
    hz = horizons.get(spot) or HorizonProfile.flat(spot, 0.0, 0.0)
    st.plotly_chart(_animation(v, sl, step, hz, start), width="stretch", key="simple_anim")
    st.caption("Grey: the real terrain around the lander, seen in every direction. When the Sun dot drops into "
               "the grey, it is hidden behind a hill and the panels make no power.")

    site_lon = next((s.lon for s in _sites() if s.id == spot), None)
    if _patch(spot) is not None and site_lon is not None:
        st.markdown("**The ground around the lander in 3D** (40 × 40 km of NASA LOLA terrain, heights × 3)")
        n_h = sl.stop - sl.start
        h = st.slider("Hour of the mission", 0, n_h - 1, 0, key="simple_hour",
                      help="Move through the mission and watch the shadows the low Sun casts.")
        k = sl.start + h
        when = start + pd.Timedelta(hours=h * step)
        up = bool(v.sun_fraction[k] >= 0.5)
        title = (f"Day {h * step / 24 + 1:.0f}, {when:%d %b %H:%M} UTC · Sun {v.sun_alt[k]:.1f}° up, "
                 + ("shining on the lander" if up else "hidden from the lander"))
        fig3d = _scene(spot, site_lon, float(v.sun_az[k]), float(v.sun_alt[k]), float(v.earth_az[k]),
                       float(v.earth_alt[k]), up, title)
        st.plotly_chart(fig3d, width="stretch", key="simple_3d")
        st.caption("Drag to turn the view. Shadows are cast by the terrain in this patch; ridges further away can "
                   "also hide the Sun, which the verdict above already includes.")
