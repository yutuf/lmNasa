# Site map: a PCB map of the lunar south pole

A 100 x 100 mm two-layer board. The silkscreen is a south polar stereographic map with the nine
Artemis III candidate regions, and one WS2812B LED sits at each region's best landing point as computed
by LunaNav (`data/derived_sites.yaml`), plus two published points from `data/sites.yaml`. Firmware, which
does not exist yet, is meant to colour each LED by the GO / NO-GO verdict for a chosen landing date.

Nothing here has been manufactured or powered.

## Rebuild

```
"C:/Program Files/KiCad/10.0/bin/python.exe" hardware/site_map/generate_board.py
cd hardware/site_map
kicad-cli pcb drc --refill-zones --save-board --severity-error --severity-warning --output drc_report.txt site_map.kicad_pcb
kicad-cli pcb render --output render_top.png --side top --width 1400 --height 1400 --quality high --background opaque site_map.kicad_pcb
kicad-cli pcb export step --subst-models --force -o site_map.step site_map.kicad_pcb
```

There is no schematic: `generate_board.py` is the netlist. It places the parts, routes the board with its
own grid router, draws the silkscreen and writes `led_sites.json`. `site_map.kicad_pro` is the file
kicad-cli created with its defaults; no rule or severity in it was edited.

## Map

- Projection: south polar stereographic on a sphere of radius 1737.4 km, r = 2 R tan((90 + lat) / 2),
  x = r sin(lon), y = r cos(lon). Longitude 0 (Earth side) points up, 90 E points right.
- Scale 1:4,000,000 (4 km per mm). The pole is at (53.0, 53.0) mm from the board's top-left corner.
- Check: the published Malapert point (86.0 S, 0 E) projects to x = 0.000 km, y = +121.343 km, straight
  above the pole.
- The nine region outlines span 89.3 x 59.4 mm on the board; margins to the board edge are 5.46 mm left,
  8.73 mm top, 5.25 mm right.
- Silkscreen: region outlines, dashed latitude circles at 85 S and 88 S with labels, a cross at the pole,
  an EARTH arrow pointing up, a 50 km scale bar (12.5 mm), the scale, the title, one label per LED.

## LEDs

Chain: J1 pin 2 (DIN) -> R1 330 ohm -> D1 ... D11 -> J2 pin 2 (DOUT). Chain index = D number - 1.
Positions in mm from the board's top-left corner. The full table with lat, lon and true positions is in
`led_sites.json`.

| Ref | Site id | Placed (mm) | Offset from true position |
| --- | --- | --- | --- |
| D1 | shackleton_ridge (published) | 50.11, 56.12 | 0 |
| D2 | de_gerlache_rim (published) | 51.99, 47.16 | 8.60 mm = 34.4 km |
| D3 | artemis_de_gerlache_rim_2_region_best | 43.09, 48.95 | 0 |
| D4 | artemis_peak_near_cabeus_b_region_best | 7.89, 35.30 | 0 |
| D5 | artemis_haworth_region_best | 42.14, 27.67 | 0 |
| D6 | malapert_massif_region_best | 51.77, 22.44 | 0 |
| D7 | artemis_mons_mouton_region_best | 66.15, 23.90 | 5.20 mm = 20.8 km |
| D8 | artemis_nobile_rim_1_region_best | 75.12, 22.97 | 0 |
| D9 | artemis_mons_mouton_plateau_region_best | 84.68, 20.44 | 0 |
| D10 | artemis_nobile_rim_2_region_best | 90.74, 29.19 | 0 |
| D11 | artemis_slater_plain_region_best | 69.26, 65.67 | 0 |

Two LEDs are not on their true position, because the generator keeps LED centres at least 9.0 mm apart
(room for the 100 nF capacitor and vias of each LED; the smallest distance on the board is 9.02 mm):

- D7, Mons Mouton region best: moved 20.8 km. A leader line runs to a dot at the true position, which is
  just left of D8. One silkscreen line of D8's footprint was removed so that it does not touch the dot.
- D2, published de Gerlache rim point: moved 34.4 km. Its true position lies under D3 (the de Gerlache
  Rim 2 region-best LED), so no dot can be drawn; the leader line ends at D3.

## Electrical

- 11 x WS2812B 5050, 11 x 100 nF 0603 (one next to each LED's VDD pad), R1 330 ohm 0603 in series with
  the data input, J1 1x3 2.54 mm header (5V, DIN, GND) and J2 1x3 header (5V, DOUT, GND) at the bottom
  edge, 4 M3 holes 5 mm in from the corners.
- Data chain: 217.5 mm of 0.25 mm track in 13 nets, all on the front layer, no vias, longest hop 38.5 mm.
- +5V: 0.5 mm stubs on the front, one via per LED, and a 0.8 mm bus on the back layer in chain order from
  J1 to J2 (268.1 mm).
- GND: pours on both layers, two GND vias per LED.
- DRC (`drc_report.txt`, errors and warnings): 0 violations, 0 unconnected items.

## Not verified, and known weaknesses

- Nothing has been built, soldered or powered. No firmware exists for this board.
- At this scale a typical region is only a few millimetres across, smaller than the 5 mm LED sitting in
  it. Silkscreen lines are cut where they cross pads and footprint outlines, so most region outlines are
  partly or fully hidden under their LED in `render_top.png`. A larger board or smaller LEDs (2020 size)
  would be needed to show every outline in full.
- The LED labels carry short names (for example "DG RIM 2"); the regions have no separate name labels.
- The pole cross is cut short where it meets D1's pad.
- The +5V bus is a single 0.8 mm daisy chain, not checked for voltage drop with all 11 LEDs at full white
  (roughly 0.66 A by the usual 60 mA per LED figure, which is a datasheet-level assumption, not measured).
- The script reads the YAML files with its own small parser (KiCad's Python has no PyYAML); the result was
  not cross-checked against PyYAML.
- The STEP file was exported but not opened in a CAD program. `--subst-models` was used; whether every
  part has a 3D model in it was not checked.
- Only the top render was inspected. The back layer was checked by DRC only.
