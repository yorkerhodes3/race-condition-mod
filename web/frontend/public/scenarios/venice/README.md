# Venice — evacuation case-study scenario

**Modelling exercise, not operational.** Real building geometry with an
illustrative evacuation model, so we can compare "best case" data availability
against the harder Mariupol case. Venice is a useful stress case: a dense
pedestrian island city with only two land egress points (both at the
north-west causeway). Opt-in via `?scenario=venice`.

## What is real vs. illustrative (fidelity)

| Layer | File | Fidelity | Source |
|---|---|---|---|
| Buildings | `buildings.json` | **HIGH — real** | 4,438 OpenStreetMap building-footprint centroids, Overpass `way["building"]` over the central islands (San Marco / Rialto / Cannaregio / Dorsoduro / Castello, bbox 45.428,12.315 → 45.445,12.351). © OpenStreetMap contributors (ODbL). |
| Population zones | `pois.geojson` | Illustrative | 5 origin zones placed at real sestieri (San Marco, Rialto/San Polo, Cannaregio, Dorsoduro, Castello). Positions approximate; not survey cells. |
| Exits | `pois.geojson` | Illustrative | 2 exits at the **real** land-egress points (Piazzale Roma causeway; Santa Lucia rail station) — the only vehicular/rail links to the mainland. |
| Corridor | `route.geojson` | Illustrative | One representative pedestrian corridor (San Marco → Rialto → Cannaregio → Santa Lucia). A schematic line, **not** a routed calle/canal path. |
| Demographics | `pois.geojson` | Synthetic | 12,000 people split across the 5 zones; ~40% vulnerable (children + elderly + disabled), internally consistent (guarded by `city-scenarios.spec.ts`). |

## The model (targets)

- **Population moved:** 12,000 (Z1 2,600 · Z2 2,200 · Z3 2,600 · Z4 2,400 · Z5 2,200).
- **Vulnerable:** 4,800 (40%).
- **Zones:** 5 origin cohorts, each tagged `venice-z1..z5` and colour-coded;
  agents carry their zone tag through the animation.
- **Exits:** 2 (Piazzale Roma, Santa Lucia Station); each zone's evacuees funnel
  to the **nearest** exit. Both exits sit at the NW edge, reflecting the real
  constraint that Venice can only be left by land at the causeway.
- **Family cohesion:** 0.82 (avg household size 2.2) — a movement-constraint
  parameter (households move together); illustrative, documented in
  `scenarios/city-scenarios.ts`.

## How to view

Operator Console → preset **Venice · Evacuation (case study)**, or
`?scenario=venice`. Opens on a random origin close-up; **Walk Route** rides the
corridor at eye level to inspect buildings along the way.

## Provenance & ethics

OpenStreetMap © contributors, ODbL 1.0 — attribution required. This is a
retrospective/education modelling exercise; the evacuation overlay is
illustrative and must not be used operationally or keyed to live individuals.
See `docs/P7-MARIUPOL-PREP.md` §5 and `docs/MARIUPOL-REAL-TERRAIN-PLAN.md`.
