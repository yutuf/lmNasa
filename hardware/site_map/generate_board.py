"""Generate the LunaNav "site map" PCB with KiCad's Python API (pcbnew).

A 100 x 100 mm map of the lunar south pole (south polar stereographic, longitude 0 = Earth side = up).
The nine Artemis III candidate regions are drawn on the silkscreen at true scale and one WS2812B LED
sits at each region's best landing point as computed by LunaNav, plus two published points. Firmware
(not written yet) is meant to colour each LED by the GO / NO-GO verdict for a chosen landing date.

Run with the Python that ships with KiCad (tested with KiCad 10.0.4), from anywhere:

  "C:/Program Files/KiCad/10.0/bin/python.exe" hardware/site_map/generate_board.py

Writes site_map.kicad_pcb and led_sites.json next to this file. The script is the source of the
netlist: there is no schematic. Zones are saved unfilled; fill and check them with

  kicad-cli pcb drc --refill-zones --save-board --severity-error --severity-warning \
      --output drc_report.txt site_map.kicad_pcb

Status and open points are in README.md in this folder.
"""
import heapq
import itertools
import json
import math
import os
import re
from pathlib import Path

import numpy as np
import pcbnew

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
FOOTPRINTS = Path(os.environ.get("KICAD_FOOTPRINTS", r"C:\Program Files\KiCad\10.0\share\kicad\footprints"))
OUT = HERE / "site_map.kicad_pcb"
OUT_JSON = HERE / "led_sites.json"

# ---- map ------------------------------------------------------------------------------------------
MOON_R_KM = 1737.4
KM_PER_MM = 4.0                      # 1 : 4,000,000
SCALE_N = int(round(KM_PER_MM * 1e6))
BOARD_W, BOARD_H = 100.0, 100.0
CORNER_R = 3.0
ORIGIN = (50.0, 50.0)                # board's top-left corner on the KiCad page, mm
POLE = (53.0, 53.0)                  # south pole in board coordinates (x right, y down, from the top-left corner)
MAP_AREA = (7.5, 7.5, 92.5, 84.0)    # a moved LED must stay inside this box (clear of holes and headers)

# site id, silkscreen name, region token in data/artemis_regions.json (None = published point)
SITES = [
    ("artemis_peak_near_cabeus_b_region_best", "CABEUS B", "Peak_Near_Cabeus_B"),
    ("artemis_de_gerlache_rim_2_region_best", "DG RIM 2", "de_Gerlache_Rim_2"),
    ("artemis_haworth_region_best", "HAWORTH", "Haworth"),
    ("malapert_massif_region_best", "MALAPERT", "Malapert_Massif"),
    ("artemis_mons_mouton_region_best", "MOUTON", "Mons_Mouton"),
    ("artemis_mons_mouton_plateau_region_best", "PLATEAU", "Mons_Mouton_Plateau"),
    ("artemis_nobile_rim_1_region_best", "NOBILE 1", "Nobile_Rim_1"),
    ("artemis_nobile_rim_2_region_best", "NOBILE 2", "Nobile_Rim_2"),
    ("artemis_slater_plain_region_best", "SLATER", "Slater_Plain"),
    ("shackleton_ridge", "CONN RIDGE", None),
    ("de_gerlache_rim", "DG RIM 011", None),
]

# ---- LED cell (local frame of the WS2812B at 0 degrees: +x from pad 1 to pad 4, +y from pad 1 to pad 2) ------
LED_MIN_PITCH = 9.0                  # centre to centre, mm
DOT_CLEAR = 4.8                      # a moved LED keeps this distance from the true-position dots
PAD_DX, PAD_DY = 2.45, 1.65          # measured from the library footprint (checked again after placing)
CELL = (-3.475, -4.36, 3.475, 2.775)           # LED courtyard + capacitor courtyard
CELL_HARD = ((-4.7, -3.0, 3.7, 3.0), (-3.5, -4.66, 0.15, -2.5))   # where a silkscreen dot would be hidden
CAP_AT = (-1.675, -3.6)
VIA_5V_AT = (-PAD_DX, 0.0)
VIA_GND_AT = (PAD_DX, 0.0)
VIA_CAP_GND_AT = (0.65, -3.6)

# ---- routing --------------------------------------------------------------------------------------
G = 0.2                              # router grid, mm
CLEAR = 0.2                          # copper to copper (default net class)
MARGIN = 0.2                         # grid and smoothing error budget
EDGE_CLEAR = 0.6
W_DATA, W_5V_STUB, W_5V_BUS, W_GND = 0.25, 0.5, 0.8, 0.5
VIA_D, VIA_DRILL = 0.8, 0.4
CLASS_HALF = {"data": W_DATA / 2, "bus": W_5V_BUS / 2, "via": VIA_D / 2}
SQRT2 = math.sqrt(2.0)
MOVES = ((1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
         (1, 1, SQRT2), (1, -1, SQRT2), (-1, 1, SQRT2), (-1, -1, SQRT2))

# ---- silkscreen -----------------------------------------------------------------------------------
SILK_W = 0.15
LABEL_SIZE = 1.0

mm = pcbnew.FromMM


def pt(x, y):
    return pcbnew.VECTOR2I(mm(float(x) + ORIGIN[0]), mm(float(y) + ORIGIN[1]))


def xy_mm(pos):
    return pcbnew.ToMM(pos.x) - ORIGIN[0], pcbnew.ToMM(pos.y) - ORIGIN[1]


def pad(fp, number):
    return next(p for p in fp.Pads() if p.GetNumber() == str(number))


def bbox_mm(item, grow=0.0):
    bb = item.GetBoundingBox()
    x0, y0 = xy_mm(pcbnew.VECTOR2I(bb.GetLeft(), bb.GetTop()))
    x1, y1 = xy_mm(pcbnew.VECTOR2I(bb.GetRight(), bb.GetBottom()))
    return (x0 - grow, y0 - grow, x1 + grow, y1 + grow)


def grow(rect, d):
    return (rect[0] - d, rect[1] - d, rect[2] + d, rect[3] + d)


def rects_overlap(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def in_rect(p, r):
    return r[0] <= p[0] <= r[2] and r[1] <= p[1] <= r[3]


# ---- data and projection ----------------------------------------------------------------------------
def read_sites(path):
    """id -> {lat, lon, name} from the repo's site YAML files. KiCad's Python has no PyYAML, so this reads
    only the three flat keys it needs; the result is cross-checked against PyYAML in the README."""
    sites, cur = {}, None
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*-\s+id:\s*(\S+)", line)
        if m:
            cur = sites.setdefault(m.group(1), {})
            continue
        m = re.match(r"\s+(lat|lon):\s*(-?[0-9.]+)", line)
        if m and cur is not None:
            cur[m.group(1)] = float(m.group(2))
            continue
        m = re.match(r"\s+name:\s*(.+?)\s*$", line)
        if m and cur is not None:
            cur["name"] = m.group(1)
    return sites


def project_km(lat, lon):
    """South polar stereographic on a sphere: x toward 90 E, y toward longitude 0 (Earth side), km."""
    r = 2.0 * MOON_R_KM * math.tan(math.radians(90.0 + lat) / 2.0)
    return r * math.sin(math.radians(lon)), r * math.cos(math.radians(lon))


def to_board(lat, lon):
    x, y = project_km(lat, lon)
    return POLE[0] + x / KM_PER_MM, POLE[1] - y / KM_PER_MM


def lat_radius_mm(lat):
    return 2.0 * MOON_R_KM * math.tan(math.radians(90.0 + lat) / 2.0) / KM_PER_MM


# ---- LED placement ------------------------------------------------------------------------------------
def nearest_free(true_pos, others, dots):
    """Closest point to true_pos that is LED_MIN_PITCH from every other LED and DOT_CLEAR from every dot."""
    for r in np.arange(0.1, 40.0, 0.1):
        hits = []
        for ang in range(0, 360, 2):
            p = (true_pos[0] + r * math.cos(math.radians(ang)), true_pos[1] + r * math.sin(math.radians(ang)))
            if (in_rect(p, MAP_AREA) and all(math.dist(p, o) >= LED_MIN_PITCH for o in others)
                    and all(math.dist(p, d) >= DOT_CLEAR for d in dots)):
                hits.append(p)
        if hits:
            # among the equally near candidates take the one with most room around it
            return max(hits, key=lambda p: min(math.dist(p, o) for o in others))
    return None


def place_leds(true, primary):
    """Each LED stays on its true position unless another LED is closer than LED_MIN_PITCH. Inside a group
    of conflicting sites every order is tried and the one with the smallest total offset wins (offsets of
    region-best points count ten times those of the extra published points)."""
    ids = list(true)
    group = {s: {s} for s in ids}
    for a, b in itertools.combinations(ids, 2):
        if math.dist(true[a], true[b]) < LED_MIN_PITCH and group[a] is not group[b]:
            merged = group[a] | group[b]
            for s in merged:
                group[s] = merged
    groups = []
    for s in ids:
        if group[s] not in groups:
            groups.append(group[s])
    placed = {next(iter(g)): true[next(iter(g))] for g in groups if len(g) == 1}
    for g in (g for g in groups if len(g) > 1):
        members = [s for s in ids if s in g]
        outside = [placed.get(s, true[s]) for s in ids if s not in g]
        dots = [true[s] for s in members]
        best = None
        for order in itertools.permutations(members):
            trial, cost = {}, 0.0
            for s in order:
                others = outside + list(trial.values())
                p = true[s]
                if any(math.dist(p, o) < LED_MIN_PITCH for o in others):
                    p = nearest_free(true[s], others, dots)
                    if p is None:
                        cost = math.inf
                        break
                trial[s] = p
                cost += (10.0 if primary[s] else 1.0) * math.dist(p, true[s])
            if best is None or cost < best[0] - 1e-9:
                best = (cost, trial)
        placed.update(best[1])
    return {s: (round(float(placed[s][0]), 3), round(float(placed[s][1]), 3)) for s in ids}


def chain_order(points, start, end):
    """Shortest path start -> every point once -> end (Held-Karp). A shortest path does not cross itself."""
    n = len(points)
    d = [[math.dist(a, b) for b in points] for a in points]
    best = {(1 << j, j): (math.dist(start, points[j]), None) for j in range(n)}
    for mask in range(1, 1 << n):
        for j in range(n):
            if (mask, j) not in best:
                continue
            cost = best[(mask, j)][0]
            for k in range(n):
                if mask & (1 << k):
                    continue
                key = (mask | (1 << k), k)
                if key not in best or cost + d[j][k] < best[key][0]:
                    best[key] = (cost + d[j][k], j)
    full = (1 << n) - 1
    j = min(range(n), key=lambda q: best[(full, q)][0] + math.dist(points[q], end))
    order, mask = [], full
    while j is not None:
        order.append(j)
        mask, j = mask ^ (1 << j), best[(mask, j)][1]
    return order[::-1]


def led_frames():
    """Unit vectors of the LED's local frame for each orientation, measured on the library footprint."""
    fp = pcbnew.FootprintLoad(str(FOOTPRINTS / "LED_SMD.pretty"), "LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm")
    fp.SetPosition(pt(0, 0))
    frames = {}
    for rot in (0, 90, 180, 270):
        fp.SetOrientationDegrees(rot)
        p1, p2, p4 = (xy_mm(pad(fp, n).GetPosition()) for n in (1, 2, 4))
        ex = ((p4[0] - p1[0]) / (2 * PAD_DX), (p4[1] - p1[1]) / (2 * PAD_DX))
        ey = ((p2[0] - p1[0]) / (2 * PAD_DY), (p2[1] - p1[1]) / (2 * PAD_DY))
        assert abs(math.hypot(*ex) - 1.0) < 1e-6 and abs(math.hypot(*ey) - 1.0) < 1e-6, "LED pad pitch changed"
        frames[rot] = (ex, ey)
    return frames


def local_to_board(centre, frame, lx, ly):
    ex, ey = frame
    return centre[0] + lx * ex[0] + ly * ey[0], centre[1] + lx * ex[1] + ly * ey[1]


def local_rect(centre, frame, rect):
    a = local_to_board(centre, frame, rect[0], rect[1])
    b = local_to_board(centre, frame, rect[2], rect[3])
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1]))


def choose_rotations(centres, frames, start, end, dots):
    """Per LED one of four orientations so that DIN faces the previous LED and DOUT the next (exact, Viterbi)."""
    rots = sorted(frames)

    def din(i, r):
        return local_to_board(centres[i], frames[r], PAD_DX, -PAD_DY)

    def dout(i, r):
        return local_to_board(centres[i], frames[r], -PAD_DX, PAD_DY)

    def unary(i, r):
        c = sum(1000.0 for d in dots for hard in CELL_HARD if in_rect(d, local_rect(centres[i], frames[r], hard)))
        cell = grow(local_rect(centres[i], frames[r], CELL), 0.15)
        for k in range(len(centres)):       # a cell must also clear the bare LED of every other site
            if k != i and abs(k - i) != 1:
                body = (centres[k][0] - 3.475, centres[k][1] - 3.475, centres[k][0] + 3.475, centres[k][1] + 3.475)
                c += 1000.0 if rects_overlap(cell, body) else 0.0
        if i == 0:
            c += math.dist(start, din(i, r))
        if i == len(centres) - 1:
            c += math.dist(dout(i, r), end)
        return c

    def pair(i, r, s):
        a = grow(local_rect(centres[i], frames[r], CELL), 0.15)
        b = grow(local_rect(centres[i + 1], frames[s], CELL), 0.15)
        return math.dist(dout(i, r), din(i + 1, s)) + (1000.0 if rects_overlap(a, b) else 0.0)

    cost = [{r: (unary(0, r), None) for r in rots}]
    for i in range(1, len(centres)):
        row = {}
        for s in rots:
            prev = min(rots, key=lambda r: cost[i - 1][r][0] + pair(i - 1, r, s))
            row[s] = (cost[i - 1][prev][0] + pair(i - 1, prev, s) + unary(i, s), prev)
        cost.append(row)
    r = min(rots, key=lambda q: cost[-1][q][0])
    out = []
    for i in range(len(centres) - 1, -1, -1):
        out.append(r)
        r = cost[i][r][1]
    return out[::-1]


# ---- router ---------------------------------------------------------------------------------------
class Router:
    """Two-layer grid maze router (A*) with any-angle smoothing.

    A grid cell is free for a net when every copper item of another net is at least
    clearance + half the new track's width + MARGIN away from the cell centre."""

    def __init__(self):
        self.nx = int(round(BOARD_W / G)) + 1
        self.ny = int(round(BOARD_H / G)) + 1
        self.X, self.Y = np.meshgrid(np.arange(self.nx) * G, np.arange(self.ny) * G)
        self.own = {c: np.zeros((2, self.ny, self.nx), np.int32) for c in CLASS_HALF}
        self.ids = {}
        for c, half in CLASS_HALF.items():
            e = EDGE_CLEAR + half + MARGIN
            edge = (self.X < e) | (self.X > BOARD_W - e) | (self.Y < e) | (self.Y > BOARD_H - e)
            self.own[c][:, edge] = -1

    def net_id(self, name):
        return self.ids.setdefault(name, len(self.ids) + 1) if name else -1

    def _mark(self, layers, box, dist, half, name):
        nid = self.net_id(name)
        for c, class_half in CLASS_HALF.items():
            infl = half + CLEAR + class_half + MARGIN
            i0 = max(0, int(math.floor((box[0] - infl) / G)))
            i1 = min(self.nx, int(math.ceil((box[2] + infl) / G)) + 1)
            j0 = max(0, int(math.floor((box[1] - infl) / G)))
            j1 = min(self.ny, int(math.ceil((box[3] + infl) / G)) + 1)
            if i0 >= i1 or j0 >= j1:
                continue
            hit = dist(self.X[j0:j1, i0:i1], self.Y[j0:j1, i0:i1]) <= infl
            for layer in layers:
                o = self.own[c][layer, j0:j1, i0:i1]
                o[hit] = np.where((o[hit] == 0) | (o[hit] == nid), nid, -1)

    def add_rect(self, layers, r, name):
        def dist(X, Y):
            return np.hypot(np.maximum(np.maximum(r[0] - X, X - r[2]), 0.0), np.maximum(np.maximum(r[1] - Y, Y - r[3]), 0.0))
        self._mark(layers, r, dist, 0.0, name)

    def add_circle(self, layers, c, radius, name):
        self._mark(layers, (c[0], c[1], c[0], c[1]), lambda X, Y: np.hypot(X - c[0], Y - c[1]), radius, name)

    def add_segment(self, layer, a, b, width, name):
        ax, ay, bx, by = a[0], a[1], b[0], b[1]
        l2 = (bx - ax) ** 2 + (by - ay) ** 2

        def dist(X, Y):
            t = np.clip(((X - ax) * (bx - ax) + (Y - ay) * (by - ay)) / l2, 0.0, 1.0) if l2 > 0 else 0.0
            return np.hypot(X - (ax + t * (bx - ax)), Y - (ay + t * (by - ay)))
        self._mark((layer,), (min(ax, bx), min(ay, by), max(ax, bx), max(ay, by)), dist, width / 2.0, name)

    def _free(self, cls, layer, nid):
        o = self.own[cls][layer]
        return (o == 0) | (o == nid)

    def route(self, a, b, name, cls, layers_a, layers_b, via_cost, layer_cost):
        """Cells of a path from point a to point b: [(layer, i, j)], or None. Costs are in grid cells."""
        nid, nx, ny = self.net_id(name), self.nx, self.ny
        n = nx * ny
        free = [self._free(cls, layer, nid) for layer in (0, 1)]
        ok = [f.ravel().tobytes() for f in free]
        okv = (free[0] & free[1] & self._free("via", 0, nid) & self._free("via", 1, nid)).ravel().tobytes()
        ia, ja, ib, jb = (int(round(v / G)) for v in (a[0], a[1], b[0], b[1]))
        goal, low = jb * nx + ib, min(layer_cost)
        dist, came, heap = {}, {}, []
        for layer in layers_a:
            if ok[layer][ja * nx + ia]:
                dist[layer * n + ja * nx + ia] = 0.0
                heapq.heappush(heap, (0.0, 0.0, layer * n + ja * nx + ia))
        found = None
        while heap:
            _, gc, s = heapq.heappop(heap)
            if gc > dist[s]:
                continue
            layer, r = divmod(s, n)
            if r == goal and layer in layers_b:
                found = s
                break
            j, i = divmod(r, nx)
            okl, lc = ok[layer], layer_cost[layer]
            for di, dj, c in MOVES:
                ii, jj = i + di, j + dj
                if 0 <= ii < nx and 0 <= jj < ny and okl[jj * nx + ii]:
                    t, ng = layer * n + jj * nx + ii, gc + c * lc
                    if ng < dist.get(t, math.inf):
                        dist[t], came[t] = ng, s
                        dx, dy = abs(ii - ib), abs(jj - jb)
                        heapq.heappush(heap, (ng + low * (max(dx, dy) + (SQRT2 - 1.0) * min(dx, dy)), ng, t))
            if okv[r]:
                t, ng = (1 - layer) * n + r, gc + via_cost
                if ng < dist.get(t, math.inf):
                    dist[t], came[t] = ng, s
                    dx, dy = abs(i - ib), abs(j - jb)
                    heapq.heappush(heap, (ng + low * (max(dx, dy) + (SQRT2 - 1.0) * min(dx, dy)), ng, t))
        if found is None:
            return None
        cells, s = [], found
        while True:
            layer, r = divmod(s, n)
            cells.append((layer, r % nx, r // nx))
            if s not in came:
                break
            s = came[s]
        cells.reverse()
        # smooth each single-layer run: skip cells while the straight line stays on free cells
        out, run_start = [], 0
        for k in range(1, len(cells) + 1):
            if k == len(cells) or cells[k][0] != cells[run_start][0]:
                run, okl = cells[run_start:k], ok[cells[run_start][0]]
                keep, i = [run[0]], 0
                while i < len(run) - 1:
                    j = i + 1
                    while j + 1 < len(run) and self._sight(okl, run[i], run[j + 1]):
                        j += 1
                    keep.append(run[j])
                    i = j
                out.append(keep)
                run_start = k
        return out

    def _sight(self, okl, p, q):
        steps = 4 * max(abs(q[1] - p[1]), abs(q[2] - p[2])) + 1
        for k in range(1, steps):
            t = k / steps
            i, j = int(round(p[1] + (q[1] - p[1]) * t)), int(round(p[2] + (q[2] - p[2]) * t))
            if not okl[j * self.nx + i]:
                return False
        return True


# ---- silkscreen helpers -----------------------------------------------------------------------------
def clip_segment(a, b, rects, step=0.05, shortest=0.3):
    """The parts of segment a-b that lie outside every rectangle in `rects` (an (n, 4) array)."""
    length = math.dist(a, b)
    n = max(1, int(math.ceil(length / step)))
    t = np.linspace(0.0, 1.0, n + 1)
    x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
    hidden = ((x[:, None] >= rects[:, 0]) & (x[:, None] <= rects[:, 2])
              & (y[:, None] >= rects[:, 1]) & (y[:, None] <= rects[:, 3])).any(axis=1)
    hidden |= (x < 1.2) | (x > BOARD_W - 1.2) | (y < 1.2) | (y > BOARD_H - 1.2)
    parts, k = [], 0
    while k <= n:
        if hidden[k]:
            k += 1
            continue
        e = k
        while e + 1 <= n and not hidden[e + 1]:
            e += 1
        if (e - k) * length / n >= min(shortest, length - 1e-9):
            parts.append(((float(x[k]), float(y[k])), (float(x[e]), float(y[e]))))
        k = e + 1
    return parts


def main():
    # -- data, projection check, scale ------------------------------------------------------------------
    derived = read_sites(REPO / "data" / "derived_sites.yaml")
    published = read_sites(REPO / "data" / "sites.yaml")
    regions = json.loads((REPO / "data" / "artemis_regions.json").read_text(encoding="utf-8"))["regions"]
    mx, my = project_km(published["malapert_massif"]["lat"], published["malapert_massif"]["lon"])
    assert abs(mx) < 1e-9 and abs(my - 121.3) < 0.05, f"projection check failed: Malapert at ({mx}, {my}) km"
    print(f"projection check: published Malapert point (86.0 S, 0 E) -> x = {mx:.3f} km, y = +{my:.3f} km (above the pole)")
    print(f"scale: {KM_PER_MM:g} km per mm, 1:{SCALE_N:,}")

    outline_km = [project_km(lat, lon) for r in regions.values() for line in r["lines"] for lat, lon in line]
    xs, ys = [p[0] for p in outline_km], [p[1] for p in outline_km]
    print(f"region outlines span x {min(xs):.1f}..{max(xs):.1f} km, y {min(ys):.1f}..{max(ys):.1f} km "
          f"= {(max(xs) - min(xs)) / KM_PER_MM:.1f} x {(max(ys) - min(ys)) / KM_PER_MM:.1f} mm on the board")
    map_box = (POLE[0] + min(xs) / KM_PER_MM, POLE[1] - max(ys) / KM_PER_MM,
               POLE[0] + max(xs) / KM_PER_MM, POLE[1] - min(ys) / KM_PER_MM)
    assert map_box[0] > 4.0 and map_box[1] > 4.0 and map_box[2] < BOARD_W - 4.0 and map_box[3] < BOARD_H - 4.0
    print(f"outline margins to the board edge: left {map_box[0]:.2f}, top {map_box[1]:.2f}, "
          f"right {BOARD_W - map_box[2]:.2f}, bottom {BOARD_H - map_box[3]:.2f} mm")

    info = {}
    for sid, label, token in SITES:
        src = derived if sid in derived else published
        info[sid] = dict(label=label, token=token, lat=src[sid]["lat"], lon=src[sid]["lon"], name=src[sid]["name"],
                         source="data/derived_sites.yaml" if sid in derived else "data/sites.yaml")
    true = {sid: to_board(v["lat"], v["lon"]) for sid, v in info.items()}
    placed = place_leds(true, {sid: v["token"] is not None for sid, v in info.items()})
    moved = [sid for sid in info if math.dist(true[sid], placed[sid]) > 0.01]     # placed is rounded to 1 um

    # -- chain order and LED orientations ------------------------------------------------------------------
    j1_at, j2_at, r1_at = (30.46, 95.0), (64.46, 95.0), (33.0, 87.0)    # header pin 1 positions, resistor centre
    chain_start, chain_end = (r1_at[0] + 0.825, r1_at[1]), (j2_at[0] + 2.54, j2_at[1])
    ids = list(info)
    order = [ids[k] for k in chain_order([placed[s] for s in ids], chain_start, chain_end)]
    frames = led_frames()
    rotations = choose_rotations([placed[s] for s in order], frames, chain_start, chain_end, [true[s] for s in moved])

    # -- board -------------------------------------------------------------------------------------------
    board = pcbnew.BOARD()
    nets = {}
    router = Router()

    def net(name):
        if name not in nets:
            nets[name] = pcbnew.NETINFO_ITEM(board, name)
            board.Add(nets[name])
        return nets[name]

    def place(lib, name, ref, value, x, y):
        fp = pcbnew.FootprintLoad(str(FOOTPRINTS / f"{lib}.pretty"), name)
        fp.SetReference(ref)
        fp.SetValue(value)
        fp.SetPosition(pt(x, y))
        fp.Reference().SetLayer(pcbnew.F_Fab)      # the silkscreen is the map: designators live on F.Fab
        board.Add(fp)
        return fp

    def best_orientation(fp, candidates, score):
        best = max(candidates, key=lambda deg: (fp.SetOrientationDegrees(deg), score(fp))[1])
        fp.SetOrientationDegrees(best)

    def track(p1, p2, netname, width, layer=pcbnew.F_Cu):
        if math.dist(p1, p2) < 1e-6:
            return
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(pt(*p1))
        t.SetEnd(pt(*p2))
        t.SetWidth(mm(width))
        t.SetLayer(layer)
        t.SetNet(net(netname))
        board.Add(t)
        router.add_segment(0 if layer == pcbnew.F_Cu else 1, p1, p2, width, netname)

    def via(p, netname):
        v = pcbnew.PCB_VIA(board)
        v.SetPosition(pt(*p))
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
        try:
            v.SetWidth(pcbnew.F_Cu, mm(VIA_D))
        except TypeError:
            v.SetWidth(mm(VIA_D))
        v.SetDrill(mm(VIA_DRILL))
        v.SetNet(net(netname))
        board.Add(v)
        router.add_circle((0, 1), p, VIA_D / 2.0, netname)

    def silk_line(p1, p2, width=SILK_W):
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(pt(*p1))
        s.SetEnd(pt(*p2))
        s.SetLayer(pcbnew.F_SilkS)
        s.SetWidth(mm(width))
        board.Add(s)

    def silk_dot(p, radius):
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_CIRCLE)
        s.SetCenter(pt(*p))
        s.SetEnd(pt(p[0] + radius, p[1]))
        s.SetLayer(pcbnew.F_SilkS)
        s.SetWidth(mm(0.1))
        s.SetFilled(True)
        board.Add(s)

    def make_text(s, x, y, size, angle=0.0):
        t = pcbnew.PCB_TEXT(board)
        t.SetText(s)
        t.SetPosition(pt(x, y))
        t.SetLayer(pcbnew.F_SilkS)
        t.SetTextSize(pcbnew.VECTOR2I(mm(size), mm(size)))
        t.SetTextThickness(mm(size * 0.15))
        if angle:
            t.SetTextAngleDegrees(angle)
        return t

    # Outline: rounded rectangle
    def edge_line(p1, p2):
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(pt(*p1))
        s.SetEnd(pt(*p2))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(mm(0.1))
        board.Add(s)

    def edge_arc(cx, cy, a0):
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_ARC)
        p = [(cx + CORNER_R * math.cos(math.radians(a)), cy + CORNER_R * math.sin(math.radians(a))) for a in (a0, a0 + 45, a0 + 90)]
        s.SetArcGeometry(pt(*p[0]), pt(*p[1]), pt(*p[2]))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(mm(0.1))
        board.Add(s)

    w, h, c = BOARD_W, BOARD_H, CORNER_R
    for p1, p2 in (((c, 0), (w - c, 0)), ((w, c), (w, h - c)), ((w - c, h), (c, h)), ((0, h - c), (0, c))):
        edge_line(p1, p2)
    for cx, cy, a0 in ((c, c, 180), (w - c, c, 270), (w - c, h - c, 0), (c, h - c, 90)):
        edge_arc(cx, cy, a0)

    hard = []            # rectangles no silkscreen text may touch
    # Mounting holes
    holes = [(5.0, 5.0), (BOARD_W - 5.0, 5.0), (5.0, BOARD_H - 5.0), (BOARD_W - 5.0, BOARD_H - 5.0)]
    for k, p in enumerate(holes, start=1):
        place("MountingHole", "MountingHole_3.2mm_M3", f"H{k}", "M3", *p)
        router.add_circle((0, 1), p, 3.3, None)
        hard.append((p[0] - 3.5, p[1] - 3.5, p[0] + 3.5, p[1] + 3.5))

    # Headers along the bottom edge: pin 1 = 5V, pin 2 = data, pin 3 = GND (left to right)
    headers = []
    for ref, value, at, data_net in (("J1", "IN", j1_at, "DATA_IN"), ("J2", "OUT", j2_at, "DATA_OUT")):
        fp = place("Connector_PinHeader_2.54mm", "PinHeader_1x03_P2.54mm_Vertical", ref, value, *at)
        best_orientation(fp, [0, 90, 180, 270],
                         lambda f: pad(f, 3).GetPosition().x - pad(f, 1).GetPosition().x)
        for n, name in ((1, "+5V"), (2, data_net), (3, "GND")):
            pad(fp, n).SetNet(net(name))
        headers.append(fp)
    j1, j2 = headers
    assert math.dist(xy_mm(pad(j2, 2).GetPosition()), chain_end) < 0.01, "output header pin 2 is not where planned"

    # Series resistor at the data input
    r1 = place("Resistor_SMD", "R_0603_1608Metric", "R1", "330R", *r1_at)
    r_in, r_out = sorted((pad(r1, 1), pad(r1, 2)), key=lambda p: p.GetPosition().x)
    r_in.SetNet(net("DATA_IN"))
    r_out.SetNet(net("LED_D0"))
    assert math.dist(xy_mm(r_out.GetPosition()), chain_start) < 0.01, "resistor pad is not where planned"

    # LED cells in chain order: LED, 100 nF, +5V via to the back-side bus, two GND vias
    leds = []
    for k, (sid, rot) in enumerate(zip(order, rotations)):
        centre, frame = placed[sid], frames[rot]

        def at(lx, ly, centre=centre, frame=frame):
            return local_to_board(centre, frame, lx, ly)

        fp = place("LED_SMD", "LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm", f"D{k + 1}", "WS2812B", *centre)
        fp.SetOrientationDegrees(rot)
        expected = {1: at(-PAD_DX, -PAD_DY), 2: at(-PAD_DX, PAD_DY), 3: at(PAD_DX, PAD_DY), 4: at(PAD_DX, -PAD_DY)}
        for n, p in expected.items():
            assert math.dist(xy_mm(pad(fp, n).GetPosition()), p) < 1e-3, f"D{k + 1} pad {n} is not where expected"
        pad(fp, 1).SetNet(net("+5V"))                       # VDD
        pad(fp, 3).SetNet(net("GND"))                       # VSS
        pad(fp, 4).SetNet(net(f"LED_D{k}"))                 # DIN
        pad(fp, 2).SetNet(net(f"LED_D{k + 1}" if k < len(order) - 1 else "DATA_OUT"))   # DOUT

        cap = place("Capacitor_SMD", "C_0603_1608Metric", f"C{k + 1}", "100n", *at(*CAP_AT))
        best_orientation(cap, [0, 90], lambda f: -abs(min(math.dist(xy_mm(p.GetPosition()), expected[1]) for p in f.Pads()) - 1.95))
        cap_5v, cap_gnd = sorted(cap.Pads(), key=lambda p: math.dist(xy_mm(p.GetPosition()), expected[1]))
        cap_5v.SetNet(net("+5V"))
        cap_gnd.SetNet(net("GND"))
        assert abs(math.dist(xy_mm(cap_5v.GetPosition()), expected[1]) - 1.95) < 0.02, "capacitor is not above pad 1"
        leds.append(dict(fp=fp, cap=cap, sid=sid, rot=rot, at=at, pads=expected, cap_5v=xy_mm(cap_5v.GetPosition()),
                         cap_gnd=xy_mm(cap_gnd.GetPosition()), cell=local_rect(centre, frame, CELL)))
    cells = [led["cell"] for led in leds]
    for a, b in itertools.combinations(range(len(leds)), 2):
        assert not rects_overlap(cells[a], cells[b]), f"D{a + 1} and D{b + 1} cells overlap"

    # Every pad is an obstacle for the router before any track is drawn
    for fp in board.GetFootprints():
        for p in fp.Pads():
            if p.GetNetname():
                layers = (0, 1) if p.GetAttribute() == pcbnew.PAD_ATTRIB_PTH else (0,)
                router.add_rect(layers, bbox_mm(p), p.GetNetname())

    for led in leds:
        at = led["at"]
        track(led["pads"][1], at(*VIA_5V_AT), "+5V", W_5V_STUB)
        track(led["pads"][1], led["cap_5v"], "+5V", W_5V_STUB)
        via(at(*VIA_5V_AT), "+5V")
        track(led["pads"][3], at(*VIA_GND_AT), "GND", W_GND)
        via(at(*VIA_GND_AT), "GND")
        track(led["cap_gnd"], at(*VIA_CAP_GND_AT), "GND", W_GND)
        via(at(*VIA_CAP_GND_AT), "GND")

    # -- routing -----------------------------------------------------------------------------------------
    stats = {}

    def connect(a, b, name, cls, width, layers_a, layers_b, via_cost, layer_cost):
        runs = router.route(a, b, name, cls, layers_a, layers_b, via_cost, layer_cost)
        assert runs is not None, f"no route for {name}"
        pts_runs = [[(run[0][0], (c[1] * G, c[2] * G)) for c in run] for run in runs]
        length, n_vias = 0.0, len(runs) - 1
        for r, run in enumerate(pts_runs):
            layer = pcbnew.F_Cu if run[0][0] == 0 else pcbnew.B_Cu
            pts = [p for _, p in run]
            if r == 0:
                pts.insert(0, a)
            if r == len(pts_runs) - 1:
                pts.append(b)
            for p1, p2 in zip(pts, pts[1:]):
                track(p1, p2, name, width, layer)
                length += math.dist(p1, p2)
            if r < len(pts_runs) - 1:
                via(pts[-1], name)
        prev = stats.get(name, (0.0, 0))
        stats[name] = (prev[0] + length, prev[1] + n_vias)

    front, both = (0,), (0, 1)
    data = dict(cls="data", width=W_DATA, via_cost=60.0, layer_cost=(1.0, 1.3))
    connect(xy_mm(pad(j1, 2).GetPosition()), xy_mm(r_in.GetPosition()), "DATA_IN", layers_a=both, layers_b=front, **data)
    connect(chain_start, leds[0]["pads"][4], "LED_D0", layers_a=front, layers_b=front, **data)
    for k in range(len(leds) - 1):
        connect(leds[k]["pads"][2], leds[k + 1]["pads"][4], f"LED_D{k + 1}", layers_a=front, layers_b=front, **data)
    connect(leds[-1]["pads"][2], chain_end, "DATA_OUT", layers_a=front, layers_b=both, **data)

    # +5V bus on the back layer, in chain order, from the input header to the output header
    bus = dict(cls="bus", width=W_5V_BUS, via_cost=400.0, layer_cost=(4.0, 1.0))
    stops = [xy_mm(pad(j1, 1).GetPosition())] + [led["at"](*VIA_5V_AT) for led in leds] + [xy_mm(pad(j2, 1).GetPosition())]
    for a, b in zip(stops, stops[1:]):
        connect(a, b, "+5V", layers_a=(1,), layers_b=(1,), **bus)

    # Ground pours on both layers
    for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
        zone = pcbnew.ZONE(board)
        zone.SetLayer(layer)
        zone.SetNet(net("GND"))
        zone.SetLocalClearance(mm(0.3))
        outline = zone.Outline()
        outline.NewOutline()
        for x, y in ((0.3, 0.3), (BOARD_W - 0.3, 0.3), (BOARD_W - 0.3, BOARD_H - 0.3), (0.3, BOARD_H - 0.3)):
            outline.Append(pt(x, y).x, pt(x, y).y)
        board.Add(zone)

    # -- silkscreen --------------------------------------------------------------------------------------
    removed_silk = []
    pad_rects, fp_silk_rects = [], []
    for fp in board.GetFootprints():
        for g in list(fp.GraphicalItems()):       # footprint silkscreen that would touch a true-position dot goes
            if g.GetLayer() == pcbnew.F_SilkS and any(in_rect(true[m], bbox_mm(g, 0.6)) for m in moved):
                fp.Remove(g)
                removed_silk.append(fp.GetReference())
        pad_rects += [bbox_mm(p, 0.3) for p in fp.Pads()]
        fp_silk_rects += [bbox_mm(g, 0.2) for g in fp.GraphicalItems() if g.GetLayer() == pcbnew.F_SilkS]
        if not fp.GetReference().startswith(("D", "C", "H")):
            hard.append(bbox_mm(fp, 0.2))
    hard += [grow(c, 0.2) for c in cells]
    hard += [grow(local_rect(placed[led["sid"]], frames[led["rot"]], (-4.6, -2.9, 3.6, 2.9)), 0.0) for led in leds]

    # map geometry: region outlines (true scale), latitude circles (dashed)
    map_lines = []
    for token, r in regions.items():
        for line in r["lines"]:
            pts = [to_board(lat, lon) for lat, lon in line]
            map_lines += list(zip(pts, pts[1:]))
    circle_lines = []
    for lat in (-85.0, -88.0):
        radius = lat_radius_mm(lat)
        n_dash = int(round(2 * math.pi * radius / 2.0))
        for k in range(n_dash):
            a0, a1 = 2 * math.pi * k / n_dash, 2 * math.pi * (k + 0.6) / n_dash
            circle_lines.append(((POLE[0] + radius * math.sin(a0), POLE[1] - radius * math.cos(a0)),
                                 (POLE[0] + radius * math.sin(a1), POLE[1] - radius * math.cos(a1))))
    samples = np.array([(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
                        for a, b in map_lines + circle_lines for t in np.linspace(0, 1, max(2, int(math.dist(a, b) / 0.1) + 1))])

    # leaders: true position (dot) -> moved LED
    dot_r = 0.3
    leaders, dots, hidden_dots = [], {}, {}
    for k, led in enumerate(leds):
        sid = led["sid"]
        if sid not in moved:
            continue
        covering = [f"D{q + 1}" for q, other in enumerate(leds) for hard_local in CELL_HARD
                    if in_rect(true[sid], local_rect(placed[other["sid"]], frames[other["rot"]], hard_local))]
        if covering:
            hidden_dots[sid] = sorted(set(covering))
        else:
            dots[sid] = true[sid]
        leaders.append((true[sid], placed[sid]))
    hard_pts = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in leaders
                for t in np.linspace(0, 1, int(math.dist(a, b) / 0.2) + 2)]

    texts = []          # (PCB_TEXT, rect)

    def text_rect(t):
        return bbox_mm(t, 0.0)

    def fits(rect, own_gap=0.3):
        r = grow(rect, own_gap)
        if r[0] < 2.0 or r[1] < 2.0 or r[2] > BOARD_W - 2.0 or r[3] > BOARD_H - 2.0:
            return False
        if any(rects_overlap(r, o) for o in hard) or any(rects_overlap(r, o) for _, o in texts):
            return False
        return not any(in_rect(p, grow(r, 0.2)) for p in hard_pts)

    def fixed_text(s, x, y, size, angle=0.0):
        t = make_text(s, x, y, size, angle)
        rect = text_rect(t)
        hits = [o for o in hard if rects_overlap(grow(rect, 0.1), o)]
        assert fits(rect, 0.1), f"fixed text {s!r} collides at ({x}, {y}): rect {rect}, hard hits {hits}"
        board.Add(t)
        texts.append((t, rect))
        return rect

    # fixed furniture: Earth arrow, title, scale bar, header labels
    arrow_x, arrow_tip, arrow_tail = POLE[0], 5.5, 15.0
    furniture = [((arrow_x, arrow_tail), (arrow_x, arrow_tip)),
                 ((arrow_x, arrow_tip), (arrow_x - 1.1, arrow_tip + 2.0)), ((arrow_x, arrow_tip), (arrow_x + 1.1, arrow_tip + 2.0))]
    hard.append((arrow_x - 1.4, arrow_tip - 0.3, arrow_x + 1.4, arrow_tail + 0.3))
    fixed_text("EARTH", arrow_x + 5.3, arrow_tip + 1.4, 1.4)
    fixed_text("LunaNav lunar south pole", 50.0, 77.2, 1.8)
    fixed_text("Artemis III candidate regions", 50.0, 80.4, 1.1)
    bar_km = 50.0
    bar_mm, bar_y = bar_km / KM_PER_MM, 85.0
    bar_x0 = 50.0 - bar_mm / 2.0
    furniture += [((bar_x0, bar_y), (bar_x0 + bar_mm, bar_y)), ((bar_x0, bar_y - 0.8), (bar_x0, bar_y + 0.8)),
                  ((bar_x0 + bar_mm, bar_y - 0.8), (bar_x0 + bar_mm, bar_y + 0.8))]
    hard.append((bar_x0 - 0.3, bar_y - 1.0, bar_x0 + bar_mm + 0.3, bar_y + 1.0))
    fixed_text(f"{bar_km:g} km", 50.0, bar_y - 2.0, 1.0)
    fixed_text(f"1:{SCALE_N:,}".replace(",", " "), 50.0, bar_y + 2.1, 1.0)
    for fp, names, tag in ((j1, ("5V", "DIN", "GND"), "IN"), (j2, ("5V", "DOUT", "GND"), "OUT")):
        for n, name in zip((1, 2, 3), names):
            x, y = xy_mm(pad(fp, n).GetPosition())
            fixed_text(name, x, y - 2.3 - 0.45 * len(name), 0.9, 90.0)
        x, y = xy_mm(pad(fp, 1).GetPosition())
        fixed_text(tag, x - 3.9 - 0.55 * len(tag), y, 1.2)
    pole_cross = [((POLE[0] - 1.5, POLE[1]), (POLE[0] + 1.5, POLE[1])), ((POLE[0], POLE[1] - 1.5), (POLE[0], POLE[1] + 1.5))]
    hard.append((POLE[0] - 1.6, POLE[1] - 1.6, POLE[0] + 1.6, POLE[1] + 1.6))
    hard += [(d[0] - 0.5, d[1] - 0.5, d[0] + 0.5, d[1] + 0.5) for d in dots.values()]

    # LED labels: "D<n> <NAME>", tried around the LED's cell; the place that hides the least map wins
    label_at = {}
    for k, led in enumerate(leds):
        s = f"D{k + 1} {info[led['sid']]['label']}"
        t = make_text(s, 0.0, 0.0, LABEL_SIZE)
        r0 = text_rect(t)
        tw, th = r0[2] - r0[0], r0[3] - r0[1]
        cell, (cx, cy) = led["cell"], placed[led["sid"]]
        best = None
        for gap in (0.5, 1.0, 1.6, 2.4, 3.4, 4.6, 6.0):
            cands = []
            for x in (cx, cell[0] + tw / 2, cell[2] - tw / 2, cx - tw / 2, cx + tw / 2, cell[0] - tw / 4, cell[2] + tw / 4):
                cands += [(x, cell[1] - gap - th / 2), (x, cell[3] + gap + th / 2)]
            for y in (cy, cell[1] + th / 2, cell[3] - th / 2, cell[1] - th, cell[3] + th):
                cands += [(cell[0] - gap - tw / 2, y), (cell[2] + gap + tw / 2, y)]
            for x, y in cands:
                rect = (x - tw / 2, y - th / 2, x + tw / 2, y + th / 2)
                if not fits(rect):
                    continue
                g = grow(rect, 0.3)
                covered = int(((samples[:, 0] >= g[0]) & (samples[:, 0] <= g[2])
                               & (samples[:, 1] >= g[1]) & (samples[:, 1] <= g[3])).sum())
                score = 2.0 * gap + 0.15 * covered + 0.05 * math.dist((x, y), (cx, cy))
                if best is None or score < best[0]:
                    best = (score, x, y, rect)
        assert best is not None, f"no free place for label {s!r}"
        t.SetPosition(pt(best[1], best[2]))
        board.Add(t)
        texts.append((t, best[3]))
        label_at[led["sid"]] = (round(best[1], 2), round(best[2], 2))

    # latitude labels: on their circle, at the first free azimuth going round from south-west
    for lat in (-85.0, -88.0):
        radius, s = lat_radius_mm(lat), f"{-lat:g}°S"
        t = make_text(s, 0.0, 0.0, LABEL_SIZE)
        r0 = text_rect(t)
        tw, th = r0[2] - r0[0], r0[3] - r0[1]
        for az in [225 + d for k in range(0, 180, 5) for d in (k, -k)]:
            x, y = POLE[0] + radius * math.sin(math.radians(az)), POLE[1] - radius * math.cos(math.radians(az))
            rect = (x - tw / 2, y - th / 2, x + tw / 2, y + th / 2)
            if fits(rect):
                t.SetPosition(pt(x, y))
                board.Add(t)
                texts.append((t, rect))
                break
        else:
            raise AssertionError(f"no free place for the {s} label")

    # draw: furniture as is, map lines and leaders clipped at pads, footprint silkscreen, texts and furniture
    for a, b in furniture:
        silk_line(a, b, 0.2)
    for a, b in pole_cross:                    # the pole cross gives way to pads and footprint silkscreen
        for p, q in clip_segment(a, b, np.array(pad_rects + fp_silk_rects)):
            silk_line(p, q, 0.2)
    clip = np.array(pad_rects + fp_silk_rects + [grow(r, 0.35) for _, r in texts]
                    + [(arrow_x - 1.5, arrow_tip - 0.4, arrow_x + 1.5, arrow_tail + 0.4),
                       (bar_x0 - 0.5, bar_y - 1.2, bar_x0 + bar_mm + 0.5, bar_y + 1.2),
                       (POLE[0] - 1.9, POLE[1] - 1.9, POLE[0] + 1.9, POLE[1] + 1.9)])
    n_outline = n_circle = 0
    for a, b in map_lines:
        for p, q in clip_segment(a, b, clip):
            silk_line(p, q)
            n_outline += 1
    dot_clip = np.array([(d[0] - dot_r - 0.2, d[1] - dot_r - 0.2, d[0] + dot_r + 0.2, d[1] + dot_r + 0.2) for d in dots.values()]
                        or [(0.0, 0.0, 0.0, 0.0)])
    for a, b in circle_lines:
        for p, q in clip_segment(a, b, np.vstack([clip, dot_clip]), shortest=0.5):
            silk_line(p, q, 0.12)
            n_circle += 1
    led_clip = np.array([grow(c, 0.15) for c in cells] + [grow(local_rect(placed[led["sid"]], frames[led["rot"]],
                                                                         (-4.6, -2.9, 3.6, 2.9)), 0.0) for led in leds])
    leader_mm, covered_dots = {}, {}
    for (a, b), sid in zip(leaders, [led["sid"] for led in leds if led["sid"] in moved]):
        parts = clip_segment(a, b, np.vstack([clip, led_clip]), shortest=0.4)
        for p, q in parts:
            silk_line(p, q, 0.2)
        leader_mm[sid] = round(sum(math.dist(p, q) for p, q in parts), 2)
    for sid, d in dots.items():
        over = [tuple(round(float(v), 2) for v in r) for r in clip if in_rect(d, grow(tuple(r), dot_r))]
        if over:        # recorded in led_sites.json instead of stopping the build
            print(f"WARNING: true-position dot of {sid} at {d} touches silkscreen keep-out {over}")
            covered_dots[sid] = over
        silk_dot(d, dot_r)

    # Zones are saved unfilled (filling a board that was never loaded from disk crashes pcbnew);
    # the DRC command in the module docstring fills them.
    pcbnew.SaveBoard(str(OUT), board)

    # -- report ------------------------------------------------------------------------------------------
    table = []
    for k, led in enumerate(leds):
        sid = led["sid"]
        off = math.dist(true[sid], placed[sid])
        x_km, y_km = project_km(info[sid]["lat"], info[sid]["lon"])
        table.append(dict(
            chain_index=k, ref=f"D{k + 1}", capacitor=f"C{k + 1}", site_id=sid, name=info[sid]["name"],
            silk_label=info[sid]["label"], kind="region_best" if info[sid]["token"] else "published_point",
            region=info[sid]["token"], source=info[sid]["source"], lat=info[sid]["lat"], lon=info[sid]["lon"],
            map_km=[round(x_km, 2), round(y_km, 2)],
            true_mm=[round(true[sid][0], 3), round(true[sid][1], 3)], placed_mm=[placed[sid][0], placed[sid][1]],
            offset_mm=round(off, 2), offset_km=round(off * KM_PER_MM, 1), moved=sid in moved,
            true_dot="none (LED is on the true position)" if sid not in moved
            else ("drawn, but touching another silkscreen item" if sid in covered_dots
                  else "drawn" if sid in dots else "hidden under " + ", ".join(hidden_dots[sid])),
            leader_visible_mm=leader_mm.get(sid), rotation_deg=led["rot"], label_mm=list(label_at[sid])))
    OUT_JSON.write_text(json.dumps(dict(
        board="site_map", units="mm from the board's top-left corner, x right, y down",
        projection="south polar stereographic, sphere R = 1737.4 km, longitude 0 up, 90 E right",
        km_per_mm=KM_PER_MM, scale=f"1:{SCALE_N}", pole_mm=list(POLE), board_mm=[BOARD_W, BOARD_H],
        led_min_pitch_mm=LED_MIN_PITCH, chain="J1 pin 2 -> R1 -> D1 ... -> last LED -> J2 pin 2", leds=table), indent=2,
        ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"wrote {OUT.name}: {len(leds)} LEDs, {len(moved)} moved off their true position")
    for row in table:
        print(f"  {row['ref']:4s} idx {row['chain_index']:2d} {row['site_id']:42s} rot {row['rotation_deg']:3d} "
              f"placed ({row['placed_mm'][0]:6.2f}, {row['placed_mm'][1]:6.2f}) offset {row['offset_mm']:5.2f} mm "
              f"= {row['offset_km']:5.1f} km  dot: {row['true_dot']}")
    print(f"footprint silkscreen items removed next to a true-position dot: {removed_silk}")
    gaps = [math.dist(placed[a], placed[b]) for a, b in itertools.combinations(ids, 2)]
    print(f"smallest LED centre distance: {min(gaps):.2f} mm")
    data_len = sum(v[0] for n, v in stats.items() if n != "+5V")
    data_vias = sum(v[1] for n, v in stats.items() if n != "+5V")
    longest = max((v[0], n) for n, v in stats.items() if n != "+5V")
    print(f"data chain: {data_len:.1f} mm of track in {len(stats) - 1} nets, {data_vias} vias, longest hop {longest[1]} {longest[0]:.1f} mm")
    print(f"+5V bus (back layer): {stats['+5V'][0]:.1f} mm, {stats['+5V'][1]} layer changes")
    print(f"silkscreen: {n_outline} outline segments, {n_circle} latitude dashes, {len(texts)} texts, "
          f"{len(dots)} true-position dots, {len(hidden_dots)} hidden")


if __name__ == "__main__":
    main()
