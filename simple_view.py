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
from lunanav.anywhere import GlobalGrid, _direction, load_earth_distance, rotate_earth, rotate_sun
from lunanav.derive import sun_radius_deg
from lunanav.geometry import disk_visible_fraction
from lunanav.geometry import distance_bearing
from lunanav.horizon import compute_horizon
from lunanav.polar_grid import PolarGrid, polar_xy
from lunanav.visibility import Visibility

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
    ("custom", "📍 Any point",
     "Any point on the Moon: pick a landed mission, drag a small box on a map (or click it), or type the "
     "coordinates. The horizon is traced from NASA LOLA terrain on the spot (200 m grid near the south pole, "
     "1.9 km elsewhere)."),
]
CUSTOM = "custom"
SPOTS_TR = {
    "malapert_massif": ("Malapert: yayınlanan nokta",
                        "Malapert Dağı, NASA'nın bu Artemis III bölgesi için verdiği nokta (86°G)."),
    "malapert_massif_derived": ("Malapert: 447 m ötede",
                                "Yayınlanan noktadan yarım kilometreden az uzakta, aynı dağın üzerinde."),
    "malapert_massif_region_best": ("Malapert: 5 km ötede",
                                    "LunaNav'ın aynı Artemis III bölgesinde bulduğu en iyi nokta, 5 km batıda."),
    "shackleton_ridge": ("Shackleton sırtı", "Kutba 60 km uzaklıkta bir sırt; Ay'ın en çok ışık alan yerlerinden biri."),
    "apollo_11": ("Apollo 11 (ekvator)",
                  "Karşılaştırma için Sükûnet Üssü: ekvatorda gündüz de gece de iki hafta sürer."),
    "custom": ("📍 Herhangi bir nokta",
               "Ay'da herhangi bir nokta: bir iniş görevi seçin, haritada küçük bir kutu çizin (ya da tıklayın) veya "
               "koordinatları yazın. Ufuk, NASA LOLA arazi verisinden o anda hesaplanır (güney kutbunda 200 m, "
               "başka yerlerde 1,9 km ızgara)."),
}
LANGS = ("English", "Türkçe")
DEFAULT_SPOT, DEFAULT_DATE = "malapert_massif", "2027-09-09"
GOOD, BAD = "#1f9d55", "#d64545"
SUN, EARTH, GREY = "#f2b705", "#4ea8de", "#6b7280"


def _tr() -> bool:
    return st.session_state.get("lang") == "Türkçe"


def T(en: str, tr: str) -> str:
    """The English or Turkish text, following the language switch at the top of the page."""
    return tr if _tr() else en


def _pct(x: float) -> str:
    return f"%{x * 100:.0f}" if _tr() else f"{x:.0%}"


def _label(site_id: str) -> str:
    return SPOTS_TR[site_id][0] if _tr() else next(label for s, label, _ in SPOTS if s == site_id)


def _desc(site_id: str) -> str:
    return SPOTS_TR[site_id][1] if _tr() else next(d for s, _, d in SPOTS if s == site_id)


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


@st.cache_resource
def _grid():
    return PolarGrid.load()


@st.cache_resource
def _global():
    return GlobalGrid.load()


@st.cache_resource
def _earth_km():
    return load_earth_distance()


@st.cache_resource
def _missions():
    import yaml
    from pathlib import Path
    f = Path(__file__).resolve().parent / "data" / "landed_missions.yaml"
    return yaml.safe_load(f.read_text(encoding="utf-8"))["missions"] if f.exists() else []


POLAR_EDGE = -84.5   # south of this the 200 m polar grid is used, elsewhere the 1.9 km global grid


@st.cache_data(max_entries=64, show_spinner="Tracing the horizon from NASA terrain…")
def _custom(lat: float, lon: float):
    """Visibility at any point on the Moon: horizon traced from LOLA, Sun/Earth rotated from the nearest computed
    site (lunanav.anywhere; checked against independent DE440 runs to 0.018 deg, Earth parallax included)."""
    polar_pt = lat <= POLAR_EDGE and _grid() is not None
    grid = _grid() if polar_pt else _global()
    hz = compute_horizon(grid.sample_height, "custom", lat, lon, step_m=200.0 if polar_pt else 800.0,
                         source=grid.source)
    computed = [s for s in _sites() if _series(s.id)[0] is not None]
    near = min(computed, key=lambda s: distance_bearing(s.lat, s.lon, lat, lon)[0])
    v0, step, _ = _series(near.id)
    times, km = _earth_km()
    assert np.array_equal(times, v0.times_utc.astype("datetime64[s]").astype(np.int64))
    sun_alt, sun_az = rotate_sun(v0.sun_alt, v0.sun_az, near.lat, near.lon, lat, lon)
    earth_alt, earth_az = rotate_earth(v0.earth_alt, v0.earth_az, km, near.lat, near.lon, lat, lon)
    sun_h, earth_h = hz.at(sun_az), hz.at(earth_az)
    frac = disk_visible_fraction(sun_alt, sun_h, sun_radius_deg(v0.times_utc))
    v = Visibility(v0.times_utc, sun_alt, sun_az, sun_h, frac, earth_alt, earth_az, earth_h, earth_alt > earth_h)
    height = float(grid.sample_height(np.array([lat]), np.array([lon]))[0])
    return v, step, hz, near.id, height


def _verdict(site_id: str, start: pd.Timestamp, c: MissionConstraints, data=None):
    """GO / NO-GO for one spot and landing date, or None when the window runs past the data."""
    v, step = data if data is not None else _series(site_id)[:2]
    i0 = int(np.searchsorted(v.times_utc, np.datetime64(start.to_datetime64(), "s")))
    n = int(c.duration_days * 24 / step)
    if i0 + n > len(v.times_utc):
        return None
    sl = slice(i0, i0 + n)
    p = simulate_battery(v.sun_fraction[sl], v.sun_alt[sl], step, c.power)
    return evaluate_window(v.sun_fraction[sl], v.sun_alt[sl], v.earth_visible[sl], step, c, p)


def _chip(label: str, r) -> str:
    if r is None:
        colour, word = GREY, T("no data", "veri yok")
    else:
        colour, word = (GOOD, "GO") if r.meets_constraints else (BAD, "NO-GO")
    return (f"<div style='flex:1;min-width:150px;border-radius:12px;padding:10px 12px;background:{colour};"
            f"color:#ffffff'><div style='font-size:13px;opacity:.9'>{html.escape(label)}</div>"
            f"<div style='font-size:22px;font-weight:800'>{word}</div></div>")


def _hours(h: float) -> str:
    if _tr():
        return f"{h:.0f} saat" if h < 48 else f"{h / 24:.1f} gün".replace(".", ",")
    return f"{h:.0f} hours" if h < 48 else f"{h / 24:.1f} days"


def _why(r, p, c: MissionConstraints, step: float) -> str:
    """One or two plain sentences for the verdict."""
    if r.meets_constraints:
        return T(f"The lander has sunlight {r.sun_frac:.0%} of the time and can talk to Earth "
                 f"{r.comm_frac:.0%} of the time. Its battery never runs low.",
                 f"Güneşli süre {_pct(r.sun_frac)}, Dünya ile konuşabildiği süre {_pct(r.comm_frac)}. "
                 "Bataryası hiç azalmıyor.")
    parts = []
    if not p.survived:
        hour = p.first_failure_index * step if p.first_failure_index is not None else None
        when_en = f" after {_hours(hour)}" if hour is not None else ""
        when_tr = f" {_hours(hour)} sonra" if hour is not None else ""
        parts.append(T(f"The battery runs flat{when_en}: there is no sunlight for up to "
                       f"{_hours(r.longest_dark_h)} in a row.",
                       f"Batarya{when_tr} bitiyor: art arda {_hours(r.longest_dark_h)} boyunca güneş yok."))
    elif r.longest_dark_h > c.max_dark_hours:
        parts.append(T(f"There is no sunlight for {_hours(r.longest_dark_h)} in a row.",
                       f"Art arda {_hours(r.longest_dark_h)} boyunca güneş yok."))
    if r.sun_frac < c.min_sun_frac:
        parts.append(T(f"Sunlight only {r.sun_frac:.0%} of the time.", f"Güneşli süre yalnızca {_pct(r.sun_frac)}."))
    if r.comm_frac < c.min_comm_frac:
        parts.append(T(f"Earth is below the horizon {1 - r.comm_frac:.0%} of the time, so no direct radio link then.",
                       f"Dünya'nın ufkun altında olduğu süre {_pct(1 - r.comm_frac)}: o sırada doğrudan radyo "
                       "bağlantısı yok."))
    return " ".join(parts) or T("One of the mission requirements is not met.",
                                "Görevin gereksinimlerinden biri karşılanmıyor.")


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
    rows = [("sun", sun, "242,183,5", T("☀️ Sun up", "☀️ Güneş var")),
            ("earth", earth, "78,168,222", T("🌍 Earth up", "🌍 Dünya görünüyor"))]
    if link is not None:
        rows.append(("link", link.astype(float), "52,199,89", T("📡 Radio link", "📡 Radyo bağlantısı")))
    for row, vals, rgb, label in rows:
        squares = []
        for d in range(n_days):
            share = float(vals[d * per_day:(d + 1) * per_day].mean())
            squares.append(f"<div title='{T('Day', 'Gün')} {d + 1}: {_pct(share)}' style='flex:1;height:26px;"
                           f"border-radius:5px;background:rgba({rgb},{0.08 + 0.92 * share:.2f})'></div>")
        cells.append(f"<div style='display:flex;align-items:center;gap:4px'><div style='width:110px;"
                     f"font-size:14px'>{label}</div>{''.join(squares)}</div>")
    days = "".join(f"<div style='flex:1;text-align:center;font-size:12px;opacity:.6'>{d + 1}</div>"
                   for d in range(n_days))
    return ("<div style='display:flex;flex-direction:column;gap:5px'>" + "".join(cells)
            + f"<div style='display:flex;gap:4px'><div style='width:110px;font-size:12px;opacity:.6'>{T('day', 'gün')}</div>"
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
        sun = T("Sun up", "Güneş görünüyor") if s_up[k] else T("Sun HIDDEN behind the terrain",
                                                                    "Güneş arazinin ARKASINDA")
        earth = T("Earth in view", "Dünya görünüyor") if e_up[k] else T("Earth hidden", "Dünya gizli")
        stamp = f"{t:%d.%m %H:%M}" if _tr() else f"{t:%d %b %H:%M}"
        return f"{T('Day', 'Gün')} {k * step / 24 + 1:.0f}, {stamp} UTC: {sun} · {earth}"

    def markers(k):
        return [
            go.Scatter(x=[s_az[k]], y=[s_alt[k]], mode="markers+text", text=[T("Sun", "Güneş") if s_up[k] else T("Sun (hidden)", "Güneş (gizli)")],
                       textposition="top center", textfont=dict(size=15, color=SUN if s_up[k] else GREY),
                       marker=dict(size=30, color=SUN if s_up[k] else GREY, line=dict(width=2, color="#ffffff")),
                       name="Sun"),
            go.Scatter(x=[e_az[k]], y=[e_alt[k]], mode="markers+text",
                       text=[T("Earth", "Dünya") if e_up[k] else T("Earth (hidden)", "Dünya (gizli)")], textposition="bottom right",
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
                   ticktext=(["K", "KD", "D", "GD", "G", "GB", "B", "KB", "K"] if _tr() else
                             ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"]),
                   title=T("direction you are facing", "baktığınız yön"),
                   showgrid=False),
        yaxis=dict(range=[y_lo, y_hi], title=T("height above the horizon (°)", "ufkun üstündeki yükseklik (°)"), zeroline=False, showgrid=False),
        updatemenus=[dict(type="buttons", x=0.0, y=-0.14, xanchor="left", direction="left", bgcolor="#f2b705",
                          bordercolor="#f2b705", font=dict(color="#111111", size=14), buttons=[
            dict(label=T("▶ Play the mission", "▶ Görevi oynat"), method="animate",
                 args=[None, dict(frame=dict(duration=120, redraw=True), fromcurrent=True, transition=dict(duration=0))]),
            dict(label=T("⏸ Pause", "⏸ Durdur"), method="animate",
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
    return z, x, y, spacing, curvature_corrected(z, x, y), 40.0


@st.cache_data(max_entries=16)
def _patch_at(lat: float, lon: float, size_km: float = 40.0, spacing_m: float = 200.0):
    """The same kind of patch, sampled around any point: from the polar grid near the pole, else from the
    global grid on a local tangent-plane grid (x east, y north)."""
    if lat > POLAR_EDGE:
        size_km, spacing_m = 160.0, 2000.0
        n = int(size_km * 1000 / spacing_m) + 1
        km = (np.arange(n) - (n - 1) / 2) * spacing_m / 1000.0
        X, Y = np.meshgrid(km, km[::-1])
        dlat = np.degrees(Y / 1737.4)
        dlon = np.degrees(X / (1737.4 * max(np.cos(np.radians(lat)), 0.05)))
        z = _global().sample_height((lat + dlat).ravel(), (lon + dlon).ravel()).reshape(X.shape)
        return z, km, km[::-1], spacing_m, curvature_corrected(z, km, km[::-1]), size_km
    x0, y0 = polar_xy(lat, lon)
    n = int(size_km * 1000 / spacing_m) + 1
    km = (np.arange(n) - (n - 1) / 2) * spacing_m / 1000.0
    X, Y = np.meshgrid(x0 + km * 1000.0, y0 + km[::-1] * 1000.0)
    z = _grid().fine.sample(X.ravel(), Y.ravel()).reshape(X.shape)
    if not np.isfinite(z).all():
        return None
    x, y = km, km[::-1]
    return z, x, y, spacing_m, curvature_corrected(z, x, y), size_km


@st.cache_data
def _world_relief():
    g = _global()
    h = g.h[::8, ::8]                                   # 2 px/deg
    gy, gx = np.gradient(h, 1000.0)
    shade = np.clip(0.5 + 0.4 * (-gx - gy) / (np.percentile(np.hypot(gx, gy), 99) + 1e-9), 0, 1)
    lats = 90 - (np.arange(h.shape[0]) + 0.5) / 2.0
    lons = (np.arange(h.shape[1]) + 0.5) / 2.0
    lons = ((lons + 180) % 360) - 180
    order = np.argsort(lons)
    return shade[:, order], lats, lons[order]


@st.cache_data
def _globe_mesh(step_deg: float = 2.0):
    """Sphere vertices (Moon-fixed, x toward 0 E, z north) and LOLA relief shading on a step_deg grid."""
    lats = np.arange(-90, 90 + step_deg / 2, step_deg)
    lons = np.arange(-180, 180 + step_deg / 2, step_deg)
    LON, LAT = np.meshgrid(lons, lats)
    h = _global().sample_height(LAT.ravel(), LON.ravel()).reshape(LAT.shape) if _global() else np.zeros(LAT.shape)
    gy, gx = np.gradient(h)
    relief = np.clip(0.55 + 0.45 * (-gx - gy) / (np.percentile(np.abs(gx) + np.abs(gy), 99) + 1e-9), 0.05, 1.0)
    la, lo = np.radians(LAT), np.radians(LON)
    xyz = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])
    return xyz, relief


def _pin(lat, lon, r=1.0):
    la, lo = np.radians(lat), np.radians(lon)
    return r * np.cos(la) * np.cos(lo), r * np.cos(la) * np.sin(lo), r * np.sin(la)


def _globe(lat: float, lon: float, sun_dir: np.ndarray, earth_dir: np.ndarray, when: str) -> go.Figure:
    """The Moon in 3D, lit by the Sun as on the landing date, with the landing spot, landed missions and Earth."""
    xyz, relief = _globe_mesh()
    s = sun_dir / np.linalg.norm(sun_dir)
    lambert = np.clip(np.einsum("ijk,i->jk", xyz, s), 0, 1)
    light = relief * (0.07 + 0.93 * np.sqrt(lambert))
    fig = go.Figure(go.Surface(x=xyz[0], y=xyz[1], z=xyz[2], surfacecolor=light, cmin=0, cmax=1, showscale=False,
                               colorscale=[[0, "#05060c"], [0.35, "#4b4d57"], [1, "#f4efe1"]], hoverinfo="skip",
                               lighting=dict(ambient=1, diffuse=0, specular=0)))
    ms = _missions()
    mx, my, mz = _pin(np.array([m["lat"] for m in ms]), np.array([m["lon"] for m in ms]), 1.01)
    fig.add_scatter3d(x=mx, y=my, z=mz, mode="markers", marker=dict(size=3, color=SUN),
                      text=[m["name"] for m in ms], hovertemplate="%{text}<extra></extra>", showlegend=False)
    px, py, pz = _pin(lat, lon, 1.0)
    qx, qy, qz = _pin(lat, lon, 1.22)
    fig.add_scatter3d(x=[px, qx], y=[py, qy], z=[pz, qz], mode="lines", line=dict(color="#ff4b4b", width=8),
                      hoverinfo="skip", showlegend=False)
    fig.add_scatter3d(x=[qx], y=[qy], z=[qz], mode="markers+text", text=[T("landing spot", "iniş noktası")],
                      textposition="top center", marker=dict(size=7, color="#ff4b4b"),
                      textfont=dict(color="#ffffff", size=13), hoverinfo="skip", showlegend=False)
    e = earth_dir / np.linalg.norm(earth_dir)
    fig.add_scatter3d(x=[1.15 * e[0], 1.75 * e[0]], y=[1.15 * e[1], 1.75 * e[1]], z=[1.15 * e[2], 1.75 * e[2]],
                      mode="lines+text", text=["", T("to Earth", "Dünya'ya")], line=dict(color=EARTH, width=5),
                      textfont=dict(color=EARTH, size=13), hoverinfo="skip", showlegend=False)
    fig.add_scatter3d(x=[1.85 * e[0]], y=[1.85 * e[1]], z=[1.85 * e[2]], mode="markers",
                      marker=dict(size=14, color=EARTH), hoverinfo="skip", showlegend=False)
    fig.add_scatter3d(x=[1.15 * s[0], 1.75 * s[0]], y=[1.15 * s[1], 1.75 * s[1]], z=[1.15 * s[2], 1.75 * s[2]],
                      mode="lines+text", text=["", T("sunlight", "güneş ışığı")], line=dict(color=SUN, width=5),
                      textfont=dict(color=SUN, size=13), hoverinfo="skip", showlegend=False)
    view = np.array(_pin(max(min(lat, 60.0), -60.0), lon, 1.0)) * 1.55 + np.array([0, 0, 0.35])
    fig.update_layout(
        height=430, margin=dict(l=0, r=0, t=34, b=0), paper_bgcolor="rgba(0,0,0,0)",
        title=dict(text=when, font=dict(size=14, color="#c9cedb"), x=0.02),
        scene=dict(xaxis=dict(visible=False), yaxis=dict(visible=False), zaxis=dict(visible=False),
                   aspectmode="data", bgcolor="rgba(0,0,0,0)",
                   camera=dict(eye=dict(x=view[0], y=view[1], z=view[2]))))
    return fig


def _world_picker(lat: float, lon: float):
    """Whole-Moon relief map (simple cylindrical, longitude 0 = Earth-facing centre); select to choose."""
    shade, lats, lons = _world_relief()
    fig = go.Figure(go.Heatmap(x=lons, y=lats, z=shade, colorscale="Greys", showscale=False, hoverinfo="skip"))
    PX, PY = np.meshgrid(np.arange(-178.5, 180, 3.0), np.arange(-88.5, 90, 3.0))
    fig.add_scatter(x=PX.ravel(), y=PY.ravel(), mode="markers", marker=dict(size=9, color="rgba(255,255,255,0.01)"),
                    hovertemplate="%{y:.1f}°, %{x:.1f}°E<extra>" + T("select to choose", "seçmek için işaretleyin")
                    + "</extra>", showlegend=False)
    ms = _missions()
    fig.add_scatter(x=[m["lon"] for m in ms], y=[m["lat"] for m in ms], mode="markers",
                    marker=dict(size=7, color=SUN), text=[m["name"] for m in ms], hovertemplate="%{text}<extra></extra>",
                    showlegend=False)
    fig.add_scatter(x=[lon], y=[lat], mode="markers", marker=dict(size=16, color="#ff4b4b", symbol="x"),
                    hoverinfo="skip", showlegend=False)
    fig.add_annotation(x=0, y=84, text=T("near side (faces Earth)", "yakın yüz (Dünya'ya dönük)"),
                       showarrow=False, font=dict(color=EARTH, size=13))
    fig.add_annotation(x=150, y=84, text=T("far side", "uzak yüz"), showarrow=False, font=dict(color=GREY, size=13))
    fig.update_layout(height=380, margin=dict(l=0, r=0, t=10, b=0), clickmode="event+select", dragmode="select",
                      xaxis=dict(range=[-180, 180], showgrid=False, zeroline=False, title=None, tickvals=[-90, 0, 90]),
                      yaxis=dict(range=[-90, 90], showgrid=False, zeroline=False, scaleanchor="x", tickvals=[-60, 0, 60]))
    return fig


def _map_picker(lat: float, lon: float):
    """South-pole relief map; clicking anywhere selects that point."""
    g = _grid()
    km = np.arange(-150, 151, 2.0)
    X, Y = np.meshgrid(km * 1000.0, km * 1000.0)
    z = g.fine.sample(X.ravel(), Y.ravel()).reshape(X.shape)
    gy, gx = np.gradient(np.nan_to_num(z), 2000.0)
    relief = np.clip(0.5 + 0.35 * (-gx - gy) / (np.hypot(gx, gy).max() / 6 + 1e-9), 0, 1)
    pick = np.arange(-147, 148, 3.0)
    PX, PY = np.meshgrid(pick, pick)
    inside = np.hypot(PX, PY) <= 147
    PX, PY = PX[inside], PY[inside]
    plat = -90.0 + 2.0 * np.degrees(np.arctan(np.hypot(PX, PY) * 1000.0 / (2.0 * 1_737_400.0)))
    plon = np.degrees(np.arctan2(PX, PY))
    fig = go.Figure(go.Heatmap(x=km, y=km, z=relief, colorscale="Greys", showscale=False, hoverinfo="skip"))
    fig.add_scatter(x=PX, y=PY, mode="markers", marker=dict(size=7, color="rgba(255,255,255,0.01)"),
                    customdata=np.c_[plat, plon],
                    hovertemplate="%{customdata[0]:.2f}°, %{customdata[1]:.2f}°E<extra>" + T("click to choose", "seçmek için tıklayın") + "</extra>",
                    showlegend=False)
    for s_id, label, _ in SPOTS:
        s = next((x for x in _sites() if x.id == s_id), None)
        if s is not None and s.lat < -84:
            sx, sy = (a / 1000.0 for a in polar_xy(s.lat, s.lon))
            fig.add_scatter(x=[sx], y=[sy], mode="markers+text", text=[_label(s_id).split(":")[0]],
                            textposition="top center", marker=dict(size=8, color=SUN),
                            textfont=dict(color=SUN, size=12), hoverinfo="skip", showlegend=False)
    cx, cy = (a / 1000.0 for a in polar_xy(lat, lon))
    fig.add_scatter(x=[cx], y=[cy], mode="markers", marker=dict(size=16, color="#ff4b4b", symbol="x"),
                    hoverinfo="skip", showlegend=False)
    fig.add_annotation(x=0, y=140, text=T("↑ Earth side", "↑ Dünya tarafı"), showarrow=False, font=dict(color=EARTH, size=13))
    fig.update_layout(height=430, margin=dict(l=0, r=0, t=10, b=0), clickmode="event+select", dragmode="select",
                      xaxis=dict(visible=False, range=[-150, 150]),
                      yaxis=dict(visible=False, range=[-150, 150], scaleanchor="x"))
    return fig


def scene_sun(lat: float, lon: float, az: float, alt: float) -> np.ndarray:
    """Direction toward a body in patch coordinates: polar patches use the stereographic plane, others a
    local east-north grid."""
    if lat <= POLAR_EDGE:
        return sun_vector(lon, az, alt)
    a, e = math.radians(az), math.radians(alt)
    return np.array([math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e)])


def _scene(p, lat: float, lon: float, sun_az: float, sun_alt: float, earth_az: float, earth_alt: float,
           sun_up: bool, title: str) -> go.Figure | None:
    """3D terrain around the lander, lit and shadowed by the Sun at one moment."""
    if p is None:
        return None
    z, x, y, spacing, zc, _size = p
    sun = scene_sun(lat, lon, sun_az, sun_alt)
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
    for az, alt, colour, name in ((sun_az, sun_alt, SUN, T("to the Sun", "Güneş'e")),
                                  (earth_az, earth_alt, EARTH, T("to Earth", "Dünya'ya"))):
        d = scene_sun(lat, lon, az, alt) * (_size / 4.5)
        fig.add_scatter3d(x=[0, d[0]], y=[0, d[1]], z=[site_z, site_z + d[2] * 1000.0], mode="lines+text",
                          text=["", name], line=dict(color=colour, width=7), textfont=dict(color=colour, size=14),
                          hoverinfo="skip", showlegend=False)
    fig.add_scatter3d(x=[0], y=[0], z=[site_z + 150], mode="markers+text", text=[T("lander", "araç")],
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
    st.markdown(T("## Can a solar lander survive here?", "## Güneş enerjili bir iniş aracı burada yaşayabilir mi?"))
    st.markdown(T("A lander near the Moon's south pole needs **sunlight** for power and **Earth in the sky** to "
                  "talk home. Near the pole the Sun never climbs high: it circles the horizon, so a hill a few "
                  "hundred metres away can hide it for days. Pick a spot and a landing date.",
                  "Ay'ın güney kutbuna inen bir araç güç için **Güneş'e**, eve haber vermek için **gökyüzünde "
                  "Dünya'ya** ihtiyaç duyar. Kutupta Güneş hiç yükselmez, ufkun etrafında döner; birkaç yüz metre "
                  "ötedeki bir tepe onu günlerce gizleyebilir. Bir nokta ve iniş tarihi seçin."))

    ids = [s for s, *_ in SPOTS]
    url_site = st.query_params.get("site")
    default = url_site if url_site in ids else DEFAULT_SPOT
    spot = st.segmented_control(T("Landing spot", "İniş noktası"), ids, default=default, format_func=_label,
                                key="simple_spot")
    spot = spot or default
    st.caption(_desc(spot))

    if spot == CUSTOM:
        ev = st.session_state.get("simple_map")
        sel = ev.get("selection") if isinstance(ev, dict) else getattr(ev, "selection", None)
        pts = (sel.get("points") if isinstance(sel, dict) else getattr(sel, "points", None)) or []
        xy = [(float(q["x"]), float(q["y"])) for q in pts if "x" in q and "y" in q]
        if xy:
            px, py = (float(a) for a in np.mean(xy, axis=0))           # centre of the selection, map km
            if (px, py) != st.session_state.get("simple_last_pick"):
                st.session_state["simple_last_pick"] = (px, py)
                r_km = float(np.hypot(px, py))
                st.session_state["simple_lat"] = round(max(-89.9, min(-84.5, -90.0 + 2.0 * float(
                    np.degrees(np.arctan(r_km * 1000.0 / (2.0 * 1_737_400.0)))))), 3)
                st.session_state["simple_lon"] = round(float(np.degrees(np.arctan2(px, py))), 3)
        ev_w = st.session_state.get("simple_world")
        sel_w = ev_w.get("selection") if isinstance(ev_w, dict) else getattr(ev_w, "selection", None)
        pts_w = (sel_w.get("points") if isinstance(sel_w, dict) else getattr(sel_w, "points", None)) or []
        xy_w = [(float(q["x"]), float(q["y"])) for q in pts_w if "x" in q and "y" in q]
        if xy_w:
            wx, wy = (float(a) for a in np.mean(xy_w, axis=0))           # lon, lat in degrees
            if ("w", wx, wy) != st.session_state.get("simple_last_pick"):
                st.session_state["simple_last_pick"] = ("w", wx, wy)
                st.session_state["simple_lat"] = round(max(-89.9, min(89.9, wy)), 3)
                st.session_state["simple_lon"] = round(((wx + 180) % 360) - 180, 3)
        missions = _missions()
        pick = st.selectbox(T("Jump to a landed mission", "Bir iniş görevine git"), ["–"] + [m["name"] for m in missions],
                            key="simple_mission")
        if pick != "–" and pick != st.session_state.get("simple_last_mission"):
            st.session_state["simple_last_mission"] = pick
            m = next(m for m in missions if m["name"] == pick)
            st.session_state["simple_lat"], st.session_state["simple_lon"] = float(m["lat"]), float(m["lon"])
        st.session_state.setdefault("simple_lat", float(st.query_params.get("lat", -89.0)))
        st.session_state.setdefault("simple_lon", float(st.query_params.get("lon", -140.0)))
        col_a, col_b = st.columns(2)
        lat = col_a.number_input(T("Latitude (°, south is negative)", "Enlem (°, güney negatif)"), -89.9, 89.9,
                                 step=0.01, format="%.3f", key="simple_lat")
        lon = col_b.number_input(T("Longitude (°E)", "Boylam (°D)"), -180.0, 180.0, step=0.1, format="%.3f", key="simple_lon")
        which = st.segmented_control(T("Map", "Harita"), [T("Whole Moon", "Tüm Ay"), T("South pole", "Güney kutbu")],
                                     default=T("South pole", "Güney kutbu") if lat <= POLAR_EDGE else
                                     T("Whole Moon", "Tüm Ay"), key="simple_which_map")
        if which == T("South pole", "Güney kutbu"):
            st.plotly_chart(_map_picker(lat, lon), width="stretch", key="simple_map", on_select="rerun",
                            selection_mode=("points", "box"))
        else:
            st.plotly_chart(_world_picker(lat, lon), width="stretch", key="simple_world", on_select="rerun",
                            selection_mode=("points", "box"))
        v, step, hz_custom, near_id, height = _custom(round(lat, 4), round(lon, 4))
        st.caption(T(f"Ground height {height:,.0f} m. Horizon traced from LOLA terrain out to 150 km; Sun and Earth "
                     "positions rotated from the nearest computed site. Checked against the full-resolution data at "
                     "27 sites: sunlight within 0.5 points (median, worst 4.1), Earth visibility within 0.0 (median, "
                     "worst 13.9, on a narrow crest).",
                     f"Zemin yüksekliği {height:.0f} m. Ufuk LOLA arazisinden 150 km'ye kadar hesaplandı; Güneş ve "
                     "Dünya konumları en yakın hesaplanmış noktadan döndürüldü. Tam çözünürlüklü veriyle 27 noktada "
                     "karşılaştırıldı: güneşli süre 0,5 puan içinde (medyan, en kötü 4,1), Dünya görünürlüğü 0,0 "
                     "(medyan, en kötü 13,9; dar bir sırtta)."))
        site_lat, site_lon = lat, lon
        patch = _patch_at(round(lat, 3), round(lon, 3))
    else:
        v, step, _ = _series(spot)
        hz_custom = None
        site = next((s for s in _sites() if s.id == spot), None)
        site_lat, site_lon = (site.lat, site.lon) if site else (None, None)
        patch = _patch(spot)
    first, last = pd.Timestamp(v.times_utc[0]), pd.Timestamp(v.times_utc[-1])
    try:
        url_day = pd.Timestamp(st.query_params.get("start", DEFAULT_DATE)).normalize()
    except ValueError:
        url_day = pd.Timestamp(DEFAULT_DATE)
    span = pd.Timedelta(days=c.duration_days)
    day = st.date_input(T("Landing date", "İniş tarihi"), value=min(max(url_day, first), last - span).date(),
                        min_value=first.date(), max_value=(last - span).date(), key="simple_date")
    start = pd.Timestamp(day)

    i0 = int(np.searchsorted(v.times_utc, np.datetime64(start.to_datetime64(), "s")))
    sl = slice(i0, i0 + int(c.duration_days * 24 / step))
    r = evaluate_window(v.sun_fraction[sl], v.sun_alt[sl], v.earth_visible[sl], step, c)
    p = simulate_battery(v.sun_fraction[sl], v.sun_alt[sl], step, c.power)
    need = required_battery_wh(v.sun_fraction[sl], step, c.power)

    ok = r.meets_constraints
    colour, word = (GOOD, "GO") if ok else (BAD, "NO-GO")
    col_verdict, col_globe = st.columns([1.1, 1], gap="large")
    with col_globe:
        if site_lat is not None:
            k0 = sl.start
            sun_dir = _direction(v.sun_alt[k0], v.sun_az[k0], site_lat, site_lon)
            earth_dir = _direction(v.earth_alt[k0], v.earth_az[k0], site_lat, site_lon)
            st.plotly_chart(_globe(site_lat, site_lon, sun_dir, earth_dir,
                                   T(f"The Moon at landing, {start:%d %b %Y} · drag to turn",
                                     f"İnişte Ay, {start:%d.%m.%Y} · çevirmek için sürükleyin")),
                            width="stretch", key="simple_globe")
    col_verdict.markdown(
        f"<div style='border-radius:16px;padding:18px 24px;background:{colour};color:#ffffff;margin:8px 0 14px'>"
        f"<div style='font-size:52px;font-weight:800;line-height:1'>{word}</div>"
        f"<div style='font-size:19px;margin-top:8px'>{html.escape(_why(r, p, c, step))}</div>"
        f"<div style='font-size:14px;opacity:.85;margin-top:6px'>"
        + T(f"{c.duration_days:g}-day mission from {start:%d %B %Y}",
            f"{c.duration_days:g} günlük görev, başlangıç {start:%d.%m.%Y}")
        + "</div></div>", unsafe_allow_html=True)

    hour_fail = p.first_failure_index * step if p.first_failure_index is not None else None
    battery_value = (T("Lasts", "Dayanıyor") if p.survived else
                     T(f"Dies after {_hours(hour_fail)}", f"{_hours(hour_fail)} sonra bitiyor") if hour_fail
                     else T("Dies", "Bitiyor"))
    battery_note = (T("no battery needed: the panels cover it", "batarya gerekmiyor: paneller yetiyor") if need == 0
                    else T(f"a {need:,.0f} Wh battery would be enough", f"{need:,.0f} Wh batarya yeterdi".replace(",", "."))
                    if not p.survived else
                    T(f"{c.power.battery_wh:,.0f} Wh battery is enough", f"{c.power.battery_wh:,.0f} Wh batarya yetiyor".replace(",", ".")))
    dsn = _dsn()
    link = (v.earth_visible[sl] & dsn.any_in_view(v.times_utc[sl])) if dsn else None
    earth_note = (T(f"with a NASA dish facing the Moon too: {link.mean():.0%}",
                    f"NASA anteni de Ay'a dönükken: {_pct(link.mean())}") if link is not None
                  else T("of the mission", "görev süresinin"))
    col_verdict.markdown(
        "<div style='display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px'>"
        + _tile("☀️", T("Sunlight", "Güneş ışığı"), _pct(r.sun_frac), T("of the mission", "görev süresinin"),
                r.sun_frac >= c.min_sun_frac)
        + _tile("🌍", T("Earth in the sky", "Gökyüzünde Dünya"), _pct(r.comm_frac), earth_note,
                r.comm_frac >= c.min_comm_frac)
        + _tile("🔋", T("Battery", "Batarya"), battery_value, battery_note, p.survived)
        + "</div>", unsafe_allow_html=True)

    st.markdown(T("**Day by day** (brighter = more hours)", "**Gün gün** (daha parlak = daha çok saat)"))
    st.markdown(_day_strip(v, sl, step, link), unsafe_allow_html=True)
    if link is not None:
        st.caption(T(f"📡 A radio link needs Earth above the lander's horizon **and** one of NASA's Deep Space Network "
                     f"dishes (Goldstone, Madrid, Canberra) seeing the Moon at least {DEFAULT_MASK_DEG:.0f}° above "
                     "its own horizon.",
                     f"📡 Radyo bağlantısı için Dünya'nın aracın ufkunun üstünde olması **ve** NASA'nın Derin Uzay "
                     f"Ağı (Deep Space Network) antenlerinden birinin (Goldstone, Madrid, Canberra) Ay'ı kendi ufkunun "
                     f"en az {DEFAULT_MASK_DEG:.0f}° üstünde görmesi gerekir."))

    labels_ = {s: _label(s) for s, _, _ in SPOTS}
    st.markdown(T("**If the launch slips** (same spot)", "**Fırlatma gecikirse** (aynı nokta)"))
    st.markdown("<div style='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px'>" + "".join(
        _chip(name, _verdict(spot, start + pd.Timedelta(days=d), c, (v, step)))
        for name, d in ((T("On time", "Zamanında"), 0), (T("1 day late", "1 gün gecikme"), 1),
                        (T("1 week late", "1 hafta gecikme"), 7), (T("2 weeks late", "2 hafta gecikme"), 14),
                        (T("1 month late", "1 ay gecikme"), 30))) + "</div>", unsafe_allow_html=True)
    st.markdown(T(f"**Same date, other spots** ({start:%d %B %Y})", f"**Aynı tarih, diğer noktalar** ({start:%d.%m.%Y})"))
    st.markdown("<div style='display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px'>" + "".join(
        _chip(labels_[s], _verdict(s, start, c, (v, step) if s == spot else None))
        for s in labels_ if s != CUSTOM or spot == CUSTOM) + "</div>", unsafe_allow_html=True)

    st.markdown(T("**What the lander sees** — press ▶ to play the mission",
                  "**Aracın gördüğü** — görevi oynatmak için ▶'e basın"))
    hz = hz_custom or horizons.get(spot) or HorizonProfile.flat(spot, 0.0, 0.0)
    st.plotly_chart(_animation(v, sl, step, hz, start), width="stretch", key="simple_anim")
    st.caption(T("Grey: the real terrain around the lander, seen in every direction. When the Sun dot drops into "
                 "the grey, it is hidden behind a hill and the panels make no power.",
                 "Gri: aracın çevresindeki gerçek arazi, her yönde. Güneş noktası griye girdiğinde bir tepenin "
                 "arkasında kalır ve paneller güç üretmez."))

    if patch is not None and site_lon is not None:
        size = patch[5]
        st.markdown(T(f"**The ground around the lander in 3D** ({size:.0f} × {size:.0f} km of NASA LOLA terrain, "
                      "heights × 3)",
                      f"**Aracın çevresindeki arazi, 3B** (NASA LOLA verisinden {size:.0f} × {size:.0f} km, "
                      "yükseklikler × 3)"))
        n_h = sl.stop - sl.start
        h = st.slider(T("Hour of the mission", "Görevin saati"), 0, n_h - 1, 0, key="simple_hour",
                      help=T("Move through the mission and watch the shadows the low Sun casts.",
                             "Görev boyunca ilerleyin ve alçak Güneş'in düşürdüğü gölgeleri izleyin."))
        k = sl.start + h
        when = start + pd.Timedelta(hours=h * step)
        up = bool(v.sun_fraction[k] >= 0.5)
        title = T(f"Day {h * step / 24 + 1:.0f}, {when:%d %b %H:%M} UTC · Sun {v.sun_alt[k]:.1f}° up, "
                  + ("shining on the lander" if up else "hidden from the lander"),
                  f"Gün {h * step / 24 + 1:.0f}, {when:%d.%m %H:%M} UTC · Güneş {v.sun_alt[k]:.1f}° yukarıda, "
                  + ("araca vuruyor" if up else "araçtan gizli"))
        fig3d = _scene(patch, site_lat, site_lon, float(v.sun_az[k]), float(v.sun_alt[k]), float(v.earth_az[k]),
                       float(v.earth_alt[k]), up, title)
        st.plotly_chart(fig3d, width="stretch", key="simple_3d")
        st.caption(T("Drag to turn the view. Shadows are cast by the terrain in this patch; ridges further away can "
                     "also hide the Sun, which the verdict above already includes.",
                     "Görünümü çevirmek için sürükleyin. Gölgeler bu parçadaki araziden düşer; daha uzaktaki sırtlar "
                     "da Güneş'i gizleyebilir, yukarıdaki karar bunu zaten hesaba katar."))
