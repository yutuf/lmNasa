"""Measure the horizon compass board for the stand: where parts sit relative to the board centre.

Read-only. Run with the Python that ships with KiCad (tested with KiCad 10.0):

  "C:/Program Files/KiCad/10.0/bin/python.exe" hardware/horizon_compass/enclosure/board_extents.py

Prints, in millimetres with the board centre as origin (+x = east, +y = north on the board):
the outline radius, the mounting holes, the devkit pad field and courtyard, and the radial reach
of the LEDs, capacitors and vias. build_stand.py uses these numbers as its clearance inputs.
"""
import math
from pathlib import Path

import pcbnew

BOARD = Path(__file__).resolve().parents[1] / "horizon_compass.kicad_pcb"
CX, CY = 100.0, 100.0  # board centre on the page, as in generate_board.py


def xy(pos):
    """KiCad page coordinates (y down) to board coordinates (y up = north)."""
    return pcbnew.ToMM(pos.x) - CX, CY - pcbnew.ToMM(pos.y)


def box_xy(box):
    x0, y1 = xy(pcbnew.VECTOR2I(box.GetLeft(), box.GetTop()))
    x1, y0 = xy(pcbnew.VECTOR2I(box.GetRight(), box.GetBottom()))
    return x0, y0, x1, y1


def corner_radii(box):
    x0, y0, x1, y1 = box_xy(box)
    return [math.hypot(x, y) for x in (x0, x1) for y in (y0, y1)]


def main():
    board = pcbnew.LoadBoard(str(BOARD))
    edge = board.GetBoardEdgesBoundingBox()
    print(f"outline: {pcbnew.ToMM(edge.GetWidth()):.3f} x {pcbnew.ToMM(edge.GetHeight()):.3f} mm (includes the 0.1 mm line)")
    print(f"board thickness: {pcbnew.ToMM(board.GetDesignSettings().GetBoardThickness()):.2f} mm")

    reach = {}
    for fp in board.GetFootprints():
        ref = fp.GetReference()
        side = "back" if fp.IsFlipped() else "front"
        if ref.startswith("H"):
            x, y = xy(fp.GetPosition())
            drill = max(pcbnew.ToMM(p.GetDrillSize().x) for p in fp.Pads())
            pad = max(pcbnew.ToMM(p.GetSize().x) for p in fp.Pads())
            print(f"{ref}: hole at ({x:+.3f}, {y:+.3f}), drill {drill:.2f} mm, pad/keep-out {pad:.2f} mm")
        elif ref == "A1":
            pads = [xy(p.GetPosition()) for p in fp.Pads()]
            xs, ys = [p[0] for p in pads], [p[1] for p in pads]
            print(f"A1 devkit ({side}): {len(pads)} pads, x {min(xs):+.3f}..{max(xs):+.3f}, y {min(ys):+.3f}..{max(ys):+.3f}")
            court = fp.GetCourtyard(pcbnew.B_CrtYd if fp.IsFlipped() else pcbnew.F_CrtYd).BBox()
            x0, y0, x1, y1 = box_xy(court)
            print(f"A1 courtyard: x {x0:+.3f}..{x1:+.3f}, y {y0:+.3f}..{y1:+.3f}")
        else:
            kind = {"D": "LED", "C": "capacitor", "R": "resistor"}[ref[0]]
            radii = [r for p in fp.Pads() for r in corner_radii(p.GetBoundingBox())]
            lo, hi = reach.get((kind, side), (1e9, 0.0))
            reach[(kind, side)] = (min(lo, *radii), max(hi, *radii))
    for (kind, side), (lo, hi) in sorted(reach.items()):
        print(f"{kind} pads ({side}): radius {lo:.3f}..{hi:.3f} mm (pad bounding-box corners)")

    vias = [t for t in board.GetTracks() if t.GetClass() == "PCB_VIA"]
    outer = max(math.hypot(*xy(v.GetPosition())) + pcbnew.ToMM(v.GetWidth(pcbnew.F_Cu)) / 2.0 for v in vias)
    print(f"vias: {len(vias)}, outermost copper edge at radius {outer:.3f} mm")
    back = [t for t in board.GetTracks() if t.GetClass() == "PCB_TRACK" and t.GetLayer() == pcbnew.B_Cu]
    print(f"back-side tracks: {len(back)}")


if __name__ == "__main__":
    main()
