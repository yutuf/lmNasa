"""Generate the LunaNav "horizon compass" PCB with KiCad's Python API (pcbnew).

A ring of 24 addressable LEDs (15 degrees of azimuth each) around an ESP32-C3-DevKitM-1 that
plugs into the back. Firmware lights the LED in the Sun's direction (yellow) and the Earth's
direction (blue) for a chosen landing site, brightness = elevation above the terrain horizon,
and replays a lunar day in seconds.

Run with the Python that ships with KiCad (tested with KiCad 10.0):

  "C:/Program Files/KiCad/10.0/bin/python.exe" hardware/horizon_compass/generate_board.py

Writes horizon_compass.kicad_pcb next to this file. The script is the source of the netlist:
there is no schematic yet. Status and open points are in README.md in this folder.
"""
import math
import os
from pathlib import Path

import pcbnew

FOOTPRINTS = Path(os.environ.get("KICAD_FOOTPRINTS", r"C:\Program Files\KiCad\10.0\share\kicad\footprints"))
OUT = Path(__file__).with_name("horizon_compass.kicad_pcb")

N_LEDS = 24
CX, CY = 100.0, 100.0        # board centre on the page, mm
R_LED = 30.0                 # LED ring radius
R_5V = R_LED + 3.6           # +5V ring track
R_CAP = R_5V + 1.6           # decoupling capacitor centres
R_VIA = R_CAP + 2.4          # GND stitching vias
R_BOARD = 39.0

mm = pcbnew.FromMM


def pt(x, y):
    return pcbnew.VECTOR2I(mm(x), mm(y))


def polar(radius, az_deg):
    """Compass convention: azimuth 0 = up (north on the board), clockwise."""
    a = math.radians(az_deg)
    return CX + radius * math.sin(a), CY - radius * math.cos(a)


def radius_of(pos):
    return math.hypot(pcbnew.ToMM(pos.x) - CX, pcbnew.ToMM(pos.y) - CY)


def azimuth_of(pos):
    return math.degrees(math.atan2(pcbnew.ToMM(pos.x) - CX, CY - pcbnew.ToMM(pos.y))) % 360.0


def xy_mm(pos):
    return pcbnew.ToMM(pos.x), pcbnew.ToMM(pos.y)


def pad(fp, number):
    return next(p for p in fp.Pads() if p.GetNumber() == str(number))


def main():
    board = pcbnew.BOARD()
    nets = {}

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
        board.Add(fp)
        return fp

    def best_orientation(fp, candidates, score):
        best = max(candidates, key=lambda deg: (fp.SetOrientationDegrees(deg), score(fp))[1])
        fp.SetOrientationDegrees(best)

    def track(p1, p2, netname, width, layer=pcbnew.F_Cu):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(pt(*p1))
        t.SetEnd(pt(*p2))
        t.SetWidth(mm(width))
        t.SetLayer(layer)
        t.SetNet(net(netname))
        board.Add(t)

    def via(p, netname):
        v = pcbnew.PCB_VIA(board)
        v.SetPosition(pt(*p))
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
        try:
            v.SetWidth(pcbnew.F_Cu, mm(0.6))
        except TypeError:
            v.SetWidth(mm(0.6))
        v.SetDrill(mm(0.3))
        v.SetNet(net(netname))
        board.Add(v)

    def text(s, x, y, size=1.5, layer=pcbnew.F_SilkS):
        t = pcbnew.PCB_TEXT(board)
        t.SetText(s)
        t.SetPosition(pt(x, y))
        t.SetLayer(layer)
        t.SetTextSize(pcbnew.VECTOR2I(mm(size), mm(size)))
        t.SetTextThickness(mm(size * 0.15))
        board.Add(t)

    # Outline
    edge = pcbnew.PCB_SHAPE(board)
    edge.SetShape(pcbnew.SHAPE_T_CIRCLE)
    edge.SetCenter(pt(CX, CY))
    edge.SetEnd(pt(CX + R_BOARD, CY))
    edge.SetLayer(pcbnew.Edge_Cuts)
    edge.SetWidth(mm(0.1))
    board.Add(edge)

    # LED ring: VDD/DIN row faces outward, VSS/DOUT row faces the centre.
    leds = []
    for i in range(N_LEDS):
        az = i * 360.0 / N_LEDS
        fp = place("LED_SMD", "LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm", f"D{i + 1}", "WS2812B", *polar(R_LED, az))
        best_orientation(
            fp, [-az, az, 180.0 - az, 180.0 + az],
            lambda f: sum(radius_of(pad(f, n).GetPosition()) for n in (1, 4))
            - sum(radius_of(pad(f, n).GetPosition()) for n in (2, 3)),
        )
        pad(fp, 1).SetNet(net("+5V"))
        pad(fp, 3).SetNet(net("GND"))
        leds.append(fp)

    # Chain direction follows the footprint: DOUT (pad 2) must face the next LED's DIN (pad 4).
    def gap(a, b):
        pa, pb = pad(leds[a], 2).GetPosition(), pad(leds[b], 4).GetPosition()
        return math.hypot(pa.x - pb.x, pa.y - pb.y)

    step = 1 if gap(0, 1) < gap(0, N_LEDS - 1) else -1
    order = [(i * step) % N_LEDS for i in range(N_LEDS)]
    for k, idx in enumerate(order):
        pad(leds[idx], 4).SetNet(net("LED_DIN" if k == 0 else f"LED_D{k}"))
        pad(leds[idx], 2).SetNet(net(f"LED_D{k + 1}"))
    for k in range(N_LEDS - 1):
        a, b = leds[order[k]], leds[order[k + 1]]
        track(xy_mm(pad(a, 2).GetPosition()), xy_mm(pad(b, 4).GetPosition()), f"LED_D{k + 1}", 0.25)

    # +5V: stub from each LED outward to a ring track, on to its decoupling capacitor; GND via behind it.
    stub_az = []
    for i, fp in enumerate(leds):
        p1 = pad(fp, 1).GetPosition()
        az = azimuth_of(p1)
        stub_az.append(az)
        cap = place("Capacitor_SMD", "C_0603_1608Metric", f"C{i + 1}", "100n", *polar(R_CAP, az))
        best_orientation(
            cap, [90.0 - az, az - 90.0, az, -az],
            lambda f: abs(radius_of(pad(f, 1).GetPosition()) - radius_of(pad(f, 2).GetPosition())),
        )
        inner, outer = sorted((pad(cap, 1), pad(cap, 2)), key=lambda p: radius_of(p.GetPosition()))
        inner.SetNet(net("+5V"))
        outer.SetNet(net("GND"))
        track(xy_mm(p1), polar(R_5V, az), "+5V", 0.5)
        track(polar(R_5V, az), xy_mm(inner.GetPosition()), "+5V", 0.5)
        track(xy_mm(outer.GetPosition()), polar(R_VIA, az), "GND", 0.4)
        via(polar(R_VIA, az), "GND")

    # ESP32-C3-DevKitM-1 on the back (USB and antenna stay clear of the LED face).
    # Pin numbers follow Espressif's J1 (1-15) / J3 (16-30) header order: verify before ordering.
    devkit = place("RF_Module", "ESP32-C3-DevKitM-1", "A1", "ESP32-C3-DevKitM-1", CX, CY)
    devkit.SetLayerAndFlip(pcbnew.B_Cu)
    # The library footprint's origin is pin 1: shift it so the two header rows are centred on the board.
    px = [pcbnew.ToMM(p.GetPosition().x) for p in devkit.Pads()]
    py = [pcbnew.ToMM(p.GetPosition().y) for p in devkit.Pads()]
    devkit.SetPosition(pt(2 * CX - (min(px) + max(px)) / 2.0, 2 * CY - (min(py) + max(py)) / 2.0))
    devkit_nets = {"+5V": (13, 14), "GND": (1, 6, 8, 12, 15, 16, 19, 22, 27, 30), "LED_GPIO": (11,)}
    numbers = {p.GetNumber() for p in devkit.Pads()}
    for name, pins in devkit_nets.items():
        for n in pins:
            if str(n) in numbers:
                pad(devkit, n).SetNet(net(name))

    # Series resistor on the data line, bulk capacitor at the 5 V entry.
    r1 = place("Resistor_SMD", "R_0603_1608Metric", "R1", "330R", *polar(R_LED - 6.0, 0.0))
    pad(r1, 1).SetNet(net("LED_GPIO"))
    pad(r1, 2).SetNet(net("LED_DIN"))
    c_bulk = place("Capacitor_SMD", "C_0805_2012Metric", "C25", "10u", *polar(R_LED - 6.0, 180.0))

    # +5V feed: devkit 5V pins -> back-side track under the LED ring -> via onto the ring track.
    p13, p14 = xy_mm(pad(devkit, 13).GetPosition()), xy_mm(pad(devkit, 14).GetPosition())
    feed_az = azimuth_of(pad(devkit, 14).GetPosition())
    track(p13, p14, "+5V", 0.6)
    track(p14, polar(R_5V, feed_az), "+5V", 0.6, pcbnew.B_Cu)
    via(polar(R_5V, feed_az), "+5V")
    bulk_5v, bulk_gnd = sorted((pad(c_bulk, 1), pad(c_bulk, 2)), key=lambda p: math.dist(xy_mm(p.GetPosition()), p14))
    bulk_5v.SetNet(net("+5V"))
    bulk_gnd.SetNet(net("GND"))
    track(xy_mm(bulk_5v.GetPosition()), p14, "+5V", 0.5)
    stub_az.append(feed_az)

    ring_az = []
    stub_az.sort()
    for a, b in zip(stub_az, stub_az[1:] + [stub_az[0] + 360.0]):
        ring_az += [a + (b - a) * j / 4.0 for j in range(4)]
    for a, b in zip(ring_az, ring_az[1:] + [ring_az[0] + 360.0]):
        track(polar(R_5V, a), polar(R_5V, b), "+5V", 0.6)

    # Data: GPIO -> R1 -> between the pad columns of the first LED -> its DIN.
    gpio, r_in, r_out = (xy_mm(pad(f, n).GetPosition()) for f, n in ((devkit, 11), (r1, 1), (r1, 2)))
    din = xy_mm(pad(leds[order[0]], 4).GetPosition())
    lane_x = CX + (0.5 if din[0] > CX else -0.5)
    for a, b in zip([r_out, (lane_x, r_out[1] - 2.5), (lane_x, din[1])], [(lane_x, r_out[1] - 2.5), (lane_x, din[1]), din]):
        track(a, b, "LED_DIN", 0.25)
    col_x = gpio[0] - math.copysign(2.93, gpio[0] - CX)
    route = [r_in, (r_in[0], r_in[1] + 2.5), (col_x, r_in[1] + 4.5), (col_x, gpio[1]), gpio]
    for a, b in zip(route, route[1:]):
        track(a, b, "LED_GPIO", 0.25)

    # Two M3 mounting holes, outside the devkit's footprint and inside the LED ring.
    for k, side in enumerate((-1, 1), start=1):
        place("MountingHole", "MountingHole_3.2mm_M3", f"H{k}", "M3", CX + side * 19.5, CY)

    # Ground pours on both layers.
    for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
        zone = pcbnew.ZONE(board)
        zone.SetLayer(layer)
        zone.SetNet(net("GND"))
        outline = zone.Outline()
        outline.NewOutline()
        for k in range(72):
            x, y = polar(R_BOARD - 0.5, k * 5.0)
            outline.Append(mm(x), mm(y))
        board.Add(zone)

    # Silkscreen: compass points and title.
    for label, az in (("N", 0), ("E", 90), ("S", 180), ("W", 270)):
        text(label, *polar(R_LED - 4.2, az + 7.5), size=1.6)
    for line, dy, size in (("LunaNav", -5.0, 1.8), ("horizon compass", -2.0, 1.2), ("Sun: yellow", 1.0, 1.0),
                           ("Earth: blue", 3.0, 1.0), ("15 deg per LED", 5.5, 1.0)):
        text(line, CX, CY + dy, size=size)

    # Zones are saved unfilled (filling a board that was never loaded from disk crashes pcbnew);
    # fill them with: kicad-cli pcb drc --refill-zones --save-board horizon_compass.kicad_pcb
    pcbnew.SaveBoard(str(OUT), board)
    direction = "clockwise" if step == 1 else "counter-clockwise"
    print(f"wrote {OUT.name}: {N_LEDS} LEDs, chain runs {direction} from D1 (north), devkit pads: {len(numbers)}")


if __name__ == "__main__":
    main()
