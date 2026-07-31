# New York City — evacuation case-study scenario + NYC Marathon route

**Modelling exercise, not operational.** Real building geometry with an
illustrative evacuation model, plus an approximate polyline of the annual
TCS New York City Marathon course for comparison with the Las Vegas Strip
Marathon scenario. Opt-in via `?scenario=nyc`.

## What is real vs. illustrative (fidelity)

| Layer | File | Fidelity | Source |
|---|---|---|---|
| Buildings | `buildings.json` | **HIGH — real** | 2,568 OpenStreetMap building-footprint centroids, Overpass `way["building"]` over Midtown Manhattan / Central Park South (bbox 40.758,-73.992 → 40.776,-73.968). © OpenStreetMap contributors (ODbL). |
| Population zones | `pois.geojson` | Illustrative | 5 origin zones at real Midtown districts (Times Square, Rockefeller Center, Central Park South, Hell's Kitchen, Midtown East). Positions approximate; not census blocks. |
| Exits | `pois.geojson` | Illustrative | 2 exits (Columbus Circle west; Grand Central / 5th Ave east) at plausible egress edges. |
| Corridor | `route.geojson` | Illustrative | One representative corridor (Times Square → Central Park South → Columbus Circle). Schematic line, **not** a routed street path. |
| Demographics | `pois.geojson` | Synthetic | 12,000 people split across the 5 zones; ~40% vulnerable (children + elderly + disabled), internally consistent (guarded by `city-scenarios.spec.ts`). |
| Marathon course | `marathon.geojson` | **MEDIUM — approximate real** | Polyline of the published TCS NYC Marathon 5-borough route (Staten Island → Brooklyn → Queens → Manhattan → Bronx → Central Park). 45 waypoints trace the real bridges/avenues; **not** the surveyed centreline. Straight-chord length ~37.4 km vs the official 42.195 km (see below). |

## The evacuation model (targets)

- **Population moved:** 12,000 (Z1 2,600 · Z2 2,200 · Z3 2,600 · Z4 2,400 · Z5 2,200).
- **Vulnerable:** 4,800 (40%).
- **Zones:** 5 origin cohorts, tagged `nyc-z1..z5` and colour-coded.
- **Exits:** 2 (Columbus Circle, Grand Central); each zone funnels to the **nearest**.
- **Family cohesion:** 0.72 (avg household size 2.0) — Manhattan skews to smaller
  households, so cohesion is lower than the European cities. Illustrative;
  documented in `scenarios/city-scenarios.ts`.

## The NYC Marathon route (`marathon.geojson`)

Modelled to answer: *how close can we get to mimicking the Las Vegas Strip
Marathon?* Both are **26.2 mi / 42.195 km**.

| | Las Vegas Strip Marathon | TCS New York City Marathon |
|---|---|---|
| Distance | 42.195 km (26.2 mi) | 42.195 km (26.2 mi) official; ~37.4 km as our chord polyline |
| Shape | Strip loop (out-and-back on Las Vegas Blvd) | Point-to-point, 5 boroughs |
| Start / Finish | Same Strip vicinity | Fort Wadsworth (SI) → Tavern on the Green (Central Park) |
| Bridges | none | Verrazzano-Narrows, Pulaski, Queensboro, Willis Ave, Madison Ave |
| Fidelity here | schematic loop | approximate real polyline (45 waypoints) |

**How close did we get?** The polyline reproduces the **shape and the exact
five-borough sequence** of the real course, anchored on the real bridges and
avenues. Measured as straight chords it comes to **~37.4 km — about 88% of the
official 42.195 km**; the missing ~12% is street-grid curvature and small
dog-legs that a coarse hand-authored polyline omits. So: geometry/route faithful,
absolute distance approximate. To close the gap you would trace the surveyed
GPX centreline (out of scope — that data is not vendored here).

The marathon polyline is a **data artifact for comparison** and is not rendered
into the Midtown schematic scene (the course spans ~20 km across five boroughs,
far larger than the Midtown building patch). It documents how the real course
maps onto geography versus the Vegas loop.

## How to view

Operator Console → preset **NYC · Evacuation (case study)**, or `?scenario=nyc`.
Opens on a random origin close-up; **Walk Route** rides the evacuation corridor
at eye level. The marathon course lives in `marathon.geojson`.

## Provenance & ethics

OpenStreetMap © contributors, ODbL 1.0 — attribution required. Marathon route is
an approximation of the publicly published course. This is a
retrospective/education modelling exercise; the evacuation overlay is
illustrative and must not be used operationally or keyed to live individuals.
See `docs/P7-MARIUPOL-PREP.md` §5 and `docs/MARIUPOL-REAL-TERRAIN-PLAN.md`.
