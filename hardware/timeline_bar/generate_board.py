"""Generate the LunaNav "timeline bar" PCB with KiCad's Python API (pcbnew).

Three rows of 28 addressable LEDs. A row is one landing spot, an LED is one Earth day of a
28-day window, and its colour mixes yellow (share of the day with the Sun up) and blue (share
of the day with Earth in view). The board has no controller: 5 V and data come in on J1 at the
left edge and leave on J2 at the right edge, so bars can be daisy-chained.

Run with the Python that ships with KiCad (tested with KiCad 10.0.4):

  "C:/Program Files/KiCad/10.0/bin/python.exe" hardware/timeline_bar/generate_board.py

Writes timeline_bar.kicad_pcb next to this file. The script is the source of the netlist:
there is no schematic. Status and open points are in README.md in this folder.

LED chain order (scripts/export_timeline_track.py must use the same one):
  row A, day 1..28, left to right   -> D1..D28   (chain index 0..27)
  row B, day 28..1, right to left   -> D29..D56  (chain index 28..55)
  row C, day 1..28, left to right   -> D57..D84  (chain index 56..83)
"""
import math
import os
from pathlib import Path

import pcbnew

FOOTPRINTS = Path(os.environ.get("KICAD_FOOTPRINTS", r"C:\Program Files\KiCad\10.0\share\kicad\footprints"))
OUT = Path(__file__).with_name("timeline_bar.kicad_pcb")

# All coordinates below are millimetres from the top-left corner of the board (x right, y down).
OX, OY = 40.0, 80.0          # where that corner sits on the KiCad page
BOARD_W, BOARD_H = 215.0, 45.0
N_DAYS = 28
ROWS = ("A", "B", "C")
PITCH = 7.0                  # LED pitch along a row
ROW_PITCH = 11.0
X_DAY1 = 13.0                # centre of the day-1 column
Y_ROW_A = 10.5               # centre of row A
CAP_DY = 3.6                 # LED centre to its 100 nF capacitor, toward the +5V bus
BUS_DY = 5.5                 # LED centre to the +5V bus
VSS_VIA_DY = 3.4             # LED centre to its ground via, away from the bus
BUS_W = 1.5                  # +5V bus and end joins
X_JOIN_L, X_JOIN_R = 7.5, BOARD_W - 7.5   # vertical +5V joins at the two ends
X_HOP_L, X_HOP_R = 9.0, BOARD_W - 9.1     # lanes for the row-to-row data hops
X_J1, X_J2 = 3.5, BOARD_W - 3.5
HOLES = ((4.0, 4.0), (BOARD_W - 4.0, 4.0), (4.0, BOARD_H - 4.0), (BOARD_W - 4.0, BOARD_H - 4.0))
HOLE_KEEPOUT_R = 3.4         # no copper pour under an M3 screw head

mm = pcbnew.FromMM


def pt(x, y):
    return pcbnew.VECTOR2I(mm(OX + x), mm(OY + y))


def xy_mm(pos):
    return round(pcbnew.ToMM(pos.x) - OX, 6), round(pcbnew.ToMM(pos.y) - OY, 6)


def pad(fp, number):
    return next(p for p in fp.Pads() if p.GetNumber() == str(number))


def pad_xy(fp, number):
    return xy_mm(pad(fp, number).GetPosition())


def led_xy(row, day):
    """Centre of the LED for row 0..2 and day 1..28."""
    return X_DAY1 + (day - 1) * PITCH, Y_ROW_A + row * ROW_PITCH


def chain_index(row, day):
    """Position in the data chain (0 = first LED after J1). Row B runs right to left."""
    return row * N_DAYS + ((day - 1) if row % 2 == 0 else (N_DAYS - day))


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
        fp.Reference().SetVisible(False)   # 84 LEDs on a 7 mm pitch leave no room for designators on silk
        board.Add(fp)
        return fp

    def best_orientation(fp, candidates, score):
        best = max(candidates, key=lambda deg: (fp.SetOrientationDegrees(deg), score(fp))[1])
        fp.SetOrientationDegrees(best)
        return best

    def track(p1, p2, netname, width, layer=pcbnew.F_Cu):
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(pt(*p1))
        t.SetEnd(pt(*p2))
        t.SetWidth(mm(width))
        t.SetLayer(layer)
        t.SetNet(net(netname))
        board.Add(t)
        return math.dist(p1, p2)

    def polyline(points, netname, width, layer=pcbnew.F_Cu):
        return sum(track(a, b, netname, width, layer) for a, b in zip(points, points[1:]))

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

    def text(s, x, y, size=1.5, layer=pcbnew.F_SilkS, align=pcbnew.GR_TEXT_H_ALIGN_CENTER, angle=0.0):
        t = pcbnew.PCB_TEXT(board)
        t.SetText(s)
        t.SetPosition(pt(x, y))
        t.SetLayer(layer)
        t.SetTextSize(pcbnew.VECTOR2I(mm(size), mm(size)))
        t.SetTextThickness(mm(size * 0.15))
        t.SetHorizJustify(align)
        t.SetVertJustify(pcbnew.GR_TEXT_V_ALIGN_CENTER)
        t.SetTextAngleDegrees(angle)
        board.Add(t)

    def silk_line(p1, p2, width=0.12):
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(pt(*p1))
        s.SetEnd(pt(*p2))
        s.SetLayer(pcbnew.F_SilkS)
        s.SetWidth(mm(width))
        board.Add(s)

    # Outline
    edge = pcbnew.PCB_SHAPE(board)
    edge.SetShape(pcbnew.SHAPE_T_RECT)
    edge.SetStart(pt(0.0, 0.0))
    edge.SetEnd(pt(BOARD_W, BOARD_H))
    edge.SetLayer(pcbnew.Edge_Cuts)
    edge.SetWidth(mm(0.1))
    board.Add(edge)

    # +5V buses: one between rows A and B (shared), one below row C.
    y_bus_ab = Y_ROW_A + BUS_DY
    y_bus_c = Y_ROW_A + 2 * ROW_PITCH + BUS_DY
    bus_of_row = (y_bus_ab, y_bus_ab, y_bus_c)
    bus_taps = {y_bus_ab: {X_J1, X_JOIN_L, X_JOIN_R}, y_bus_c: {X_JOIN_L, X_JOIN_R}}

    # LEDs. Orientation is chosen by measuring the pads: DIN must face the previous LED in the chain.
    leds = [None] * (len(ROWS) * N_DAYS)
    for row in range(len(ROWS)):
        direction = 1.0 if row % 2 == 0 else -1.0     # +1: chain runs left to right
        for day in range(1, N_DAYS + 1):
            k = chain_index(row, day)
            fp = place("LED_SMD", "LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm", f"D{k + 1}", "WS2812B", *led_xy(row, day))
            best_orientation(fp, [0.0, 180.0], lambda f, d=direction: d * (pad_xy(f, 2)[0] - pad_xy(f, 4)[0]))
            pad(fp, 1).SetNet(net("+5V"))
            pad(fp, 3).SetNet(net("GND"))
            pad(fp, 4).SetNet(net("LED_DIN" if k == 0 else f"LED_D{k}"))
            pad(fp, 2).SetNet(net(f"LED_D{k + 1}" if k < len(leds) - 1 else "LED_DOUT"))
            leds[k] = (fp, row, day)
            # The library silkscreen is 7.12 mm wide and carries a "1" beside pad 1: on a 7 mm pitch both
            # land on the neighbour. Move it to User.Comments (removing items from a footprint breaks the
            # Python wrapper) and draw two short edge lines and a thick bar beside VDD (pin 1) instead.
            for item in [g for g in fp.GraphicalItems() if g.GetLayer() == pcbnew.F_SilkS]:
                item.SetLayer(pcbnew.Cmts_User)
            cx, cy = led_xy(row, day)
            vdd = pad_xy(fp, 1)
            vdd_side = math.copysign(1.0, vdd[1] - cy)
            silk_line((cx - 3.2, cy - vdd_side * 2.75), (cx + 3.2, cy - vdd_side * 2.75))
            far_end = cx - math.copysign(3.2, vdd[0] - cx)
            silk_line((far_end, cy + vdd_side * 2.75), (cx, cy + vdd_side * 2.75))
            silk_line((vdd[0] - 0.6, cy + vdd_side * 2.8), (vdd[0] + 0.6, cy + vdd_side * 2.8), width=0.3)

    # Per LED: 100 nF next to VDD, +5V stub to the bus, ground vias for the capacitor and for VSS.
    for k, (fp, row, day) in enumerate(leds):
        cx, cy = led_xy(row, day)
        y_bus = bus_of_row[row]
        side = math.copysign(1.0, y_bus - cy)          # +1: bus is below this row
        vdd, vss = pad_xy(fp, 1), pad_xy(fp, 3)
        if (vdd[1] - cy) * side <= 0 or (vss[1] - cy) * side >= 0:
            raise SystemExit(f"D{k + 1}: VDD must face the +5V bus and VSS the other side; measured {vdd}, {vss}")
        inward = math.copysign(1.0, cx - vdd[0])       # the capacitor extends under the LED, not into the neighbour
        cap = place("Capacitor_SMD", "C_0603_1608Metric", f"C{k + 1}", "100n", vdd[0] + inward * 0.775, cy + side * CAP_DY)
        p5, pg = sorted((pad(cap, 1), pad(cap, 2)), key=lambda p: abs(xy_mm(p.GetPosition())[0] - vdd[0]))
        p5.SetNet(net("+5V"))
        pg.SetNet(net("GND"))
        c5, cg = xy_mm(p5.GetPosition()), xy_mm(pg.GetPosition())
        if abs(c5[0] - vdd[0]) > 0.01:
            raise SystemExit(f"C{k + 1}: +5V pad is not in line with the VDD pad ({c5} vs {vdd})")
        polyline([vdd, c5, (vdd[0], y_bus)], "+5V", 0.5)
        bus_taps[y_bus].add(vdd[0])
        g_via = (cg[0] + inward * 1.2, cg[1])
        track(cg, g_via, "GND", 0.4)
        via(g_via, "GND")
        v_via = (vss[0], cy - side * VSS_VIA_DY)
        track(vss, v_via, "GND", 0.4)
        via(v_via, "GND")

    # Data chain inside a row: straight from DOUT to the next DIN (measured, not assumed).
    hop_mm = []
    for k in range(len(leds) - 1):
        (a, row_a, _), (b, row_b, _) = leds[k], leds[k + 1]
        dout, din = pad_xy(a, 2), pad_xy(b, 4)
        name = f"LED_D{k + 1}"
        if row_a == row_b:
            hop_mm.append(track(dout, din, name, 0.25))
        elif dout[0] > BOARD_W / 2:
            # Right end (A to B): the hop crosses the shared +5V bus, so it dives to the back layer.
            top, bottom = (X_HOP_R, dout[1]), (X_HOP_R, din[1])
            length = (track(dout, top, name, 0.25) + track(top, bottom, name, 0.25, pcbnew.B_Cu)
                      + track(bottom, din, name, 0.25))
            via(top, name)
            via(bottom, name)
            hop_mm.append(length)
        else:
            # Left end (B to C): no bus in the way, stays on the front between the LEDs and the join.
            hop_mm.append(polyline([dout, (X_HOP_L, dout[1]), (X_HOP_L, din[1]), din], name, 0.25))

    # J1 input header at the left edge: pin 1 = 5V (on the bus, lowest), pin 2 = DIN, pin 3 = GND.
    j1 = place("Connector_PinHeader_2.54mm", "PinHeader_1x03_P2.54mm_Vertical", "J1", "IN: 5V DIN GND", X_J1, y_bus_ab)
    best_orientation(j1, [0.0, 180.0], lambda f: pad_xy(f, 1)[1] - pad_xy(f, 3)[1])
    j1.SetPosition(pt(2 * X_J1 - pad_xy(j1, 1)[0], 2 * y_bus_ab - pad_xy(j1, 1)[1]))
    # J2 output header at the right edge, between rows B and C: pin 1 = 5V (top), pin 2 = DOUT, pin 3 = GND.
    y_j2 = Y_ROW_A + 1.5 * ROW_PITCH - 2.54
    j2 = place("Connector_PinHeader_2.54mm", "PinHeader_1x03_P2.54mm_Vertical", "J2", "OUT: 5V DOUT GND", X_J2, y_j2)
    best_orientation(j2, [0.0, 180.0], lambda f: pad_xy(f, 3)[1] - pad_xy(f, 1)[1])
    j2.SetPosition(pt(2 * X_J2 - pad_xy(j2, 1)[0], 2 * y_j2 - pad_xy(j2, 1)[1]))
    for header, data_net in ((j1, "HDR_DIN"), (j2, "LED_DOUT")):
        pad(header, 1).SetNet(net("+5V"))
        pad(header, 2).SetNet(net(data_net))
        pad(header, 3).SetNet(net("GND"))

    # R1: 330 ohm in the data line between J1 and the first LED.
    first_din = pad_xy(leds[0][0], 4)
    r1 = place("Resistor_SMD", "R_0603_1608Metric", "R1", "330R", X_J1 + 3.8, first_din[1] - 0.55)
    r_in, r_out = sorted((pad(r1, 1), pad(r1, 2)), key=lambda p: xy_mm(p.GetPosition())[0])
    r_in.SetNet(net("HDR_DIN"))
    r_out.SetNet(net("LED_DIN"))
    r_in, r_out, j1_din = xy_mm(r_in.GetPosition()), xy_mm(r_out.GetPosition()), pad_xy(j1, 2)
    drop = j1_din[1] - r_in[1]
    polyline([j1_din, (r_in[0] - drop, j1_din[1]), r_in], "HDR_DIN", 0.25)
    rise = first_din[1] - r_out[1]
    polyline([r_out, (first_din[0] - 0.55 - rise, r_out[1]), (first_din[0] - 0.55, first_din[1]), first_din],
             "LED_DIN", 0.25)

    # Last LED to J2: one via, then on the back under the +5V join to the header pin.
    last_dout, j2_dout = pad_xy(leds[-1][0], 2), pad_xy(j2, 2)
    out_via = (X_HOP_R, last_dout[1])
    track(last_dout, out_via, "LED_DOUT", 0.25)
    via(out_via, "LED_DOUT")
    polyline([out_via, (X_HOP_R, j2_dout[1] + 1.5), (X_HOP_R + 1.5, j2_dout[1]), j2_dout],
             "LED_DOUT", 0.25, pcbnew.B_Cu)

    # 10 uF bulk capacitors: one at each end of each row, each with its own ground via.
    join_taps = {X_JOIN_L: {y_bus_ab, y_bus_c}, X_JOIN_R: {y_bus_ab, y_bus_c, pad_xy(j2, 1)[1]}}
    n_bulk = 0
    for x_join, outward in ((X_JOIN_L, -1.0), (X_JOIN_R, 1.0)):
        for row in range(len(ROWS)):
            n_bulk += 1
            ref = f"C{len(leds) + n_bulk}"
            if row == 0:   # row A: upright on the corner where the bus meets the join
                target = (x_join, y_bus_ab)
                cap = place("Capacitor_SMD", "C_0805_2012Metric", ref, "10u", x_join, y_bus_ab - 0.95)
                cap.SetOrientationDegrees(90.0)
                via_dx = 1.4
            else:          # rows B and C: lying across the join, level with the row
                target = (x_join, Y_ROW_A + row * ROW_PITCH)
                cap = place("Capacitor_SMD", "C_0805_2012Metric", ref, "10u", x_join + outward * 0.95, target[1])
                via_dx = outward * 1.2
                join_taps[x_join].add(target[1])
            p5, pg = sorted((pad(cap, 1), pad(cap, 2)), key=lambda p, t=target: math.dist(xy_mm(p.GetPosition()), t))
            if math.dist(xy_mm(p5.GetPosition()), target) > 0.01:
                raise SystemExit(f"{ref}: +5V pad is not on the join ({xy_mm(p5.GetPosition())} vs {target})")
            p5.SetNet(net("+5V"))
            pg.SetNet(net("GND"))
            cg = xy_mm(pg.GetPosition())
            g_via = (cg[0] + via_dx, cg[1])
            track(cg, g_via, "GND", 0.4)
            via(g_via, "GND")

    # +5V copper: two buses and two joins, cut at every tap so each junction is a track end.
    bus_mm = {}
    for y_bus, taps in bus_taps.items():
        bus_mm[y_bus] = polyline([(x, y_bus) for x in sorted(taps)], "+5V", BUS_W)
    for x_join, taps in join_taps.items():
        polyline([(x_join, y) for y in sorted(taps)], "+5V", BUS_W)
    track((X_JOIN_R, pad_xy(j2, 1)[1]), pad_xy(j2, 1), "+5V", 1.0)

    # Four M3 mounting holes in the corners, each with a pour keep-out the size of a screw head.
    for k, (hx, hy) in enumerate(HOLES, start=1):
        place("MountingHole", "MountingHole_3.2mm_M3", f"H{k}", "M3", hx, hy)
        keepout = pcbnew.ZONE(board)
        keepout.SetIsRuleArea(True)
        keepout.SetDoNotAllowZoneFills(True)
        keepout.SetDoNotAllowTracks(True)
        keepout.SetDoNotAllowVias(True)
        keepout.SetDoNotAllowPads(False)
        keepout.SetDoNotAllowFootprints(False)
        layers = pcbnew.LSET()
        layers.AddLayer(pcbnew.F_Cu)
        layers.AddLayer(pcbnew.B_Cu)
        keepout.SetLayerSet(layers)
        outline = keepout.Outline()
        outline.NewOutline()
        for j in range(36):
            a = math.radians(j * 10.0)
            outline.Append(mm(OX + hx + HOLE_KEEPOUT_R * math.cos(a)), mm(OY + hy + HOLE_KEEPOUT_R * math.sin(a)))
        board.Add(keepout)

    # The front pour below the row C bus is cut off from the rest by the bus, the joins and the hole
    # keep-outs. Stitch it to the back pour between the columns, clear of the day numbers.
    for col in range(1, N_DAYS - 1, 3):
        via((X_DAY1 + (col + 0.5) * PITCH, y_bus_c + 1.7), "GND")

    # Ground pours on both layers.
    for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
        zone = pcbnew.ZONE(board)
        zone.SetLayer(layer)
        zone.SetNet(net("GND"))
        outline = zone.Outline()
        outline.NewOutline()
        for x, y in ((0.5, 0.5), (BOARD_W - 0.5, 0.5), (BOARD_W - 0.5, BOARD_H - 0.5), (0.5, BOARD_H - 0.5)):
            outline.Append(mm(OX + x), mm(OY + y))
        board.Add(zone)

    # Silkscreen.
    left, right = pcbnew.GR_TEXT_H_ALIGN_LEFT, pcbnew.GR_TEXT_H_ALIGN_RIGHT
    text("LunaNav timeline bar", 9.0, 3.6, size=2.2, align=left)
    text("yellow = Sun    blue = Earth    1 LED = 1 Earth day", BOARD_W - 9.0, 3.6, size=1.3, align=right)
    y_days = BOARD_H - 4.4
    text("day", 9.6, y_days, size=1.1, align=right)
    for day in (1, 7, 14, 21, 28):
        text(str(day), led_xy(0, day)[0], y_days, size=1.4)
    text("A published point      B 447 m away      C best in region", BOARD_W / 2, BOARD_H - 1.9, size=1.2)
    for row, letter in enumerate(ROWS):
        text(letter, BOARD_W - 2.5, Y_ROW_A + row * ROW_PITCH, size=1.8)
    for header, x_label, labels in ((j1, 1.15, ("5V", "DI", "GND")), (j2, BOARD_W - 1.15, ("5V", "DO", "GND"))):
        for number, label in enumerate(labels, start=1):
            text(label, x_label, pad_xy(header, number)[1], size=0.8, angle=90.0)

    # Zones are saved unfilled (filling a board that was never loaded from disk crashes pcbnew);
    # fill them with: kicad-cli pcb drc --refill-zones --save-board timeline_bar.kicad_pcb
    pcbnew.SaveBoard(str(OUT), board)

    in_row = [h for k, h in enumerate(hop_mm) if leds[k][1] == leds[k + 1][1]]
    vias = [t for t in board.GetTracks() if t.GetClass() == "PCB_VIA"]
    n_gnd_vias = sum(1 for v in vias if v.GetNetname() == "GND")
    print(f"wrote {OUT.name}: {BOARD_W:g} x {BOARD_H:g} mm, {len(leds)} LEDs, {len(leds)} x 100n, {n_bulk} x 10u")
    print(f"chain: D1 = row A day 1, D{N_DAYS} = row A day {N_DAYS}, D{N_DAYS + 1} = row B day {N_DAYS}, "
          f"D{2 * N_DAYS} = row B day 1, D{2 * N_DAYS + 1} = row C day 1, D{3 * N_DAYS} = row C day {N_DAYS}")
    print(f"LED orientation (degrees) rows A, B, C: "
          f"{[leds[chain_index(r, 1)][0].GetOrientationDegrees() for r in range(len(ROWS))]}")
    print(f"data hop inside a row: {min(in_row):.2f} to {max(in_row):.2f} mm; "
          f"A to B (right end, 2 vias): {hop_mm[N_DAYS - 1]:.2f} mm; B to C (left end): {hop_mm[2 * N_DAYS - 1]:.2f} mm")
    print(f"+5V bus A/B: {bus_mm[y_bus_ab]:.1f} mm, bus C: {bus_mm[y_bus_c]:.1f} mm, width {BUS_W} mm, "
          f"joins at x = {X_JOIN_L} and {X_JOIN_R} mm")
    print(f"vias: {len(vias)} total, {n_gnd_vias} ground")


if __name__ == "__main__":
    main()
