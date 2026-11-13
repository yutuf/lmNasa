"""Build the horizon compass stand in Autodesk Fusion: a base cup and a diffuser ring.

Run as a Fusion script (Utilities > Scripts and Add-Ins) or through the Fusion MCP server. It opens a
NEW document, models both parts as solid bodies in a direct-modelling design, adds reference bodies
for the PCB and the devkit, checks interference and clearances, and exports next to this file:

  compass_stand.f3d    both parts in their assembled position, plus the reference bodies
  base_cup.stl         print orientation: floor on the bed
  diffuser_ring.stl    print orientation: flipped, the flat plate on the bed

Everything is in millimetres here; Fusion's internal unit is the centimetre (see MM).
Origin: centre of the cup, z = 0 on the table. +y = north on the board, +x = east.
Board numbers come from ../generate_board.py and from board_extents.py.
"""
import json
import math
from pathlib import Path

import adsk.core
import adsk.fusion

OUT_DIR = Path(globals().get("__file__", ".")).resolve().parent
MM = 0.1  # mm -> cm

# Board (generate_board.py, board_extents.py)
PCB_R = 39.0
PCB_T = 1.6
HOLE_X = 19.5            # M3 holes at x = -19.5 and +19.5, y = 0
HOLE_D = 3.2
LED_RING_R = 30.0
LED_SIZE = 5.0           # WS2812B 5050 body, square
LED_H = 1.6              # body height above the PCB (nominal, not measured)
N_LEDS = 24
DEVKIT_W = 25.4          # devkit board, x extent (KiCad footprint outline)
DEVKIT_L = 39.0          # y extent (footprint outline is 38.92)
ANTENNA_W = 13.2         # antenna tab on the footprint's fab layer, north end
ANTENNA_REACH = 24.86    # its far edge, mm north of the centre

# Base cup
FLOOR_T = 2.0
WALL_T = 2.0
CUP_ID = 78.6
STANDOFF = 16.0          # floor top to PCB underside (room for sockets + devkit)
RIM_ABOVE_PCB = 1.0      # PCB top face sits this far below the rim
POST_D = 7.0
POST_FOOT_D = 10.0       # 45 degree cone at the foot of each post
PILOT_D = 2.8
PILOT_DEPTH = 12.0
SLOT_W = 12.0
SLOT_H = 8.0             # wall slot, from the floor top upward
NOTCH_FROM_Y = 18.0      # the slot continues as a notch through the floor from here outward

# Diffuser ring
PLATE_T = 1.0
PLATE_ID = 52.0          # inner radius 26: the centre of the board stays open
SPACER_H = 1.5           # lifts the plate off the rim so it clears the LED bodies
LIP_DEPTH = 0.7          # how far the locating lip reaches below the rim
LIP_OD = 78.2            # 0.2 mm radial play in the 78.6 mm cup
LIP_ID = 75.8

CUP_R_IN = CUP_ID / 2.0
CUP_R_OUT = CUP_R_IN + WALL_T
PCB_Z0 = FLOOR_T + STANDOFF
PCB_Z1 = PCB_Z0 + PCB_T
RIM_Z = PCB_Z1 + RIM_ABOVE_PCB
PLATE_Z0 = RIM_Z + SPACER_H
RING_TOP_Z = PLATE_Z0 + PLATE_T


def pnt(x, y, z):
    return adsk.core.Point3D.create(x * MM, y * MM, z * MM)


def cyl(tmp, x, y, z0, z1, r0, r1=None):
    return tmp.createCylinderOrCone(pnt(x, y, z0), r0 * MM, pnt(x, y, z1), (r0 if r1 is None else r1) * MM)


def box(tmp, x0, x1, y0, y1, z0, z1, angle_deg=0.0):
    """Axis-aligned box, optionally turned about the z axis through the origin."""
    a = math.radians(angle_deg)
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    centre = pnt(cx * math.cos(a) - cy * math.sin(a), cx * math.sin(a) + cy * math.cos(a), (z0 + z1) / 2.0)
    length = adsk.core.Vector3D.create(math.cos(a), math.sin(a), 0.0)
    width = adsk.core.Vector3D.create(-math.sin(a), math.cos(a), 0.0)
    obb = adsk.core.OrientedBoundingBox3D.create(centre, length, width, (x1 - x0) * MM, (y1 - y0) * MM, (z1 - z0) * MM)
    return tmp.createBox(obb)


def base_cup(tmp):
    union, cut = adsk.fusion.BooleanTypes.UnionBooleanType, adsk.fusion.BooleanTypes.DifferenceBooleanType
    body = cyl(tmp, 0, 0, 0.0, RIM_Z, CUP_R_OUT)
    tmp.booleanOperation(body, cyl(tmp, 0, 0, FLOOR_T, RIM_Z + 1.0, CUP_R_IN), cut)
    foot_rise = (POST_FOOT_D - POST_D) / 2.0  # 45 degrees
    for side in (-1, 1):
        x = side * HOLE_X
        tmp.booleanOperation(body, cyl(tmp, x, 0, FLOOR_T - 1.0, PCB_Z0, POST_D / 2.0), union)
        tmp.booleanOperation(
            body, cyl(tmp, x, 0, FLOOR_T - 1.0, FLOOR_T + foot_rise, POST_FOOT_D / 2.0 + 1.0, POST_D / 2.0), union)
    for side in (-1, 1):
        tmp.booleanOperation(body, cyl(tmp, side * HOLE_X, 0, PCB_Z0 - PILOT_DEPTH, PCB_Z0 + 1.0, PILOT_D / 2.0), cut)
    for side in (-1, 1):  # north and south: wall slot above the floor, notch through the floor below it
        y0, y1 = sorted((side * NOTCH_FROM_Y, side * (CUP_R_OUT + 2.0)))
        tmp.booleanOperation(body, box(tmp, -SLOT_W / 2.0, SLOT_W / 2.0, y0, y1, -1.0, FLOOR_T + SLOT_H), cut)
    return body


def diffuser_ring(tmp):
    union, cut = adsk.fusion.BooleanTypes.UnionBooleanType, adsk.fusion.BooleanTypes.DifferenceBooleanType
    body = cyl(tmp, 0, 0, RIM_Z, RING_TOP_Z, CUP_R_OUT)                                        # spacer + plate
    tmp.booleanOperation(body, cyl(tmp, 0, 0, RIM_Z - LIP_DEPTH, RIM_Z + 0.5, LIP_OD / 2.0), union)  # locating lip
    tmp.booleanOperation(body, cyl(tmp, 0, 0, RIM_Z - LIP_DEPTH - 1.0, PLATE_Z0, LIP_ID / 2.0), cut)
    tmp.booleanOperation(body, cyl(tmp, 0, 0, PLATE_Z0 - 0.5, RING_TOP_Z + 1.0, PLATE_ID / 2.0), cut)
    return body


def reference_pcb(tmp):
    union, cut = adsk.fusion.BooleanTypes.UnionBooleanType, adsk.fusion.BooleanTypes.DifferenceBooleanType
    body = cyl(tmp, 0, 0, PCB_Z0, PCB_Z1, PCB_R)
    for side in (-1, 1):
        tmp.booleanOperation(body, cyl(tmp, side * HOLE_X, 0, PCB_Z0 - 1.0, PCB_Z1 + 1.0, HOLE_D / 2.0), cut)
    half = LED_SIZE / 2.0
    for i in range(N_LEDS):
        led = box(tmp, LED_RING_R - half, LED_RING_R + half, -half, half, PCB_Z1 - 0.2, PCB_Z1 + LED_H,
                  angle_deg=i * 360.0 / N_LEDS)
        tmp.booleanOperation(body, led, union)
    return body


def reference_devkit(tmp):
    """Keep-in volume: the devkit's plan area over the whole height between floor and PCB."""
    body = box(tmp, -DEVKIT_W / 2.0, DEVKIT_W / 2.0, -DEVKIT_L / 2.0, DEVKIT_L / 2.0, FLOOR_T, PCB_Z0)
    tab = box(tmp, -ANTENNA_W / 2.0, ANTENNA_W / 2.0, DEVKIT_L / 2.0 - 1.0, ANTENNA_REACH, FLOOR_T, PCB_Z0)
    tmp.booleanOperation(body, tab, adsk.fusion.BooleanTypes.UnionBooleanType)
    return body


def describe(body):
    lo, hi = body.boundingBox.minPoint, body.boundingBox.maxPoint
    return {
        "bbox_mm": [round(v / MM, 3) for v in (lo.x, lo.y, lo.z, hi.x, hi.y, hi.z)],
        "volume_cm3": round(body.volume, 3),
        "faces": body.faces.count,
        "lumps": body.lumps.count,
        "is_solid": body.isSolid,
    }


def run(_context: str):
    app = adsk.core.Application.get()
    doc = app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
    design = adsk.fusion.Design.cast(doc.products.itemByProductType("DesignProductType"))
    design.designType = adsk.fusion.DesignTypes.DirectDesignType
    design.fusionUnitsManager.distanceDisplayUnits = adsk.fusion.DistanceUnits.MillimeterDistanceUnits
    root = design.rootComponent
    tmp = adsk.fusion.TemporaryBRepManager.get()

    lib = app.materialLibraries.itemByName("Fusion Appearance Library")
    parts = {}
    for name, make, colour in (
        ("base_cup", base_cup, "Paint - Enamel Glossy (Blue)"),
        ("diffuser_ring", diffuser_ring, "Paint - Enamel Glossy (White)"),
        ("ref_pcb_with_leds", reference_pcb, "Paint - Enamel Glossy (Green)"),
        ("ref_devkit_keep_in", reference_devkit, "Paint - Enamel Glossy (Red)"),
    ):
        body = root.bRepBodies.add(make(tmp))
        body.name = name
        source = lib.appearances.itemByName(colour)
        if source:
            body.appearance = design.appearances.addByCopy(source, f"{name}_colour")
        else:
            print(f"appearance not found: {colour}")
        parts[name] = body

    report = {"bodies": {name: describe(body) for name, body in parts.items()}}

    # Interference: volume shared by any two bodies (faces that only touch do not count).
    everything = adsk.core.ObjectCollection.create()
    for body in parts.values():
        everything.add(body)
    results = design.analyzeInterference(design.createInterferenceInput(everything))
    report["interferences"] = [
        {"a": r.entityOne.name, "b": r.entityTwo.name, "volume_mm3": round(r.interferenceBody.volume * 1000.0, 4)}
        for r in results
    ]

    # Smallest gap between pairs of bodies (0 = they touch).
    measure = app.measureManager
    pairs = (("base_cup", "ref_devkit_keep_in"), ("base_cup", "ref_pcb_with_leds"), ("diffuser_ring", "ref_pcb_with_leds"),
             ("diffuser_ring", "base_cup"), ("diffuser_ring", "ref_devkit_keep_in"))
    report["min_distance_mm"] = {
        f"{a} / {b}": round(measure.measureMinimumDistance(parts[a], parts[b]).value / MM, 3) for a, b in pairs
    }

    exporter = design.exportManager
    archive = OUT_DIR / "compass_stand.f3d"
    exporter.execute(exporter.createFusionArchiveExportOptions(str(archive)))

    def export_stl(body, path):
        options = exporter.createSTLExportOptions(body, str(path))
        options.meshRefinement = adsk.fusion.MeshRefinementSettings.MeshRefinementHigh
        options.isBinaryFormat = True
        options.sendToPrintUtility = False
        exporter.execute(options)

    export_stl(parts["base_cup"], OUT_DIR / "base_cup.stl")
    # The ring prints upside down: turn a copy about the x axis and put the plate on z = 0.
    flipped = tmp.copy(parts["diffuser_ring"])
    flip = adsk.core.Matrix3D.create()
    flip.setToRotation(math.pi, adsk.core.Vector3D.create(1.0, 0.0, 0.0), adsk.core.Point3D.create(0.0, 0.0, 0.0))
    lift = adsk.core.Matrix3D.create()
    lift.translation = adsk.core.Vector3D.create(0.0, 0.0, RING_TOP_Z * MM)
    flip.transformBy(lift)
    tmp.transform(flipped, flip)
    printable = root.bRepBodies.add(flipped)
    printable.name = "diffuser_ring_print_orientation"
    report["bodies"]["diffuser_ring_print_orientation"] = describe(printable)
    export_stl(printable, OUT_DIR / "diffuser_ring.stl")
    printable.deleteMe()

    report["files"] = {p.name: p.stat().st_size for p in sorted(OUT_DIR.glob("*.f3d")) + sorted(OUT_DIR.glob("*.stl"))}
    report["levels_mm"] = {"floor_top": FLOOR_T, "pcb_underside": PCB_Z0, "pcb_top": PCB_Z1, "led_top": PCB_Z1 + LED_H,
                           "rim": RIM_Z, "lip_bottom": RIM_Z - LIP_DEPTH, "plate_underside": PLATE_Z0,
                           "ring_top": RING_TOP_Z}
    print(json.dumps(report, indent=1))
