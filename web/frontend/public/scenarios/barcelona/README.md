# Barcelona — evacuation case-study scenario

**Modelling exercise, not operational.** Real building geometry with an
illustrative evacuation model. Opt-in via `?scenario=barcelona`.

## What is real vs. illustrative (fidelity)

| Layer | File | Fidelity | Source |
|---|---|---|---|
| Buildings | `buildings.json` | **HIGH — real** | 4,243 OpenStreetMap building-footprint centroids, Overpass `way["building"]` over the Ciutat Vella / Eixample-edge district (bbox 41.380,2.160 → 41.397,2.186). © OpenStreetMap contributors (ODbL). |
| Population zones | `pois.geojson` | Illustrative | 5 origin zones at real named neighbourhoods (Barri Gòtic, El Born, El Raval, Eixample S, Sant Pere). Positions approximate. |
| Exits | `pois.geojson` | Illustrative | 2 exits (Plaça Catalunya north; Port/Barceloneta sea) at plausible egress edges. |
| Corridor | `route.geojson` | Illustrative | One representative corridor (Barri Gòtic → Plaça Catalunya). Schematic line, not a routed street path. |
| Demographics | `pois.geojson` | Synthetic | 12,000 people; ~40% vulnerable, internally consistent (guarded by `city-scenarios.spec.ts`). |

## The model (targets)

- **Population moved:** 12,000 (Z1 2,600 · Z2 2,200 · Z3 2,600 · Z4 2,400 · Z5 2,200).
- **Vulnerable:** 4,800 (40%).
- **Zones:** 5 cohorts, tagged `barcelona-z1..z5`, colour-coded, tag-carried.
- **Exits:** 2; each zone funnels to its nearest exit.
- **Family cohesion:** 0.80 (avg household size 2.5) — movement-constraint
  parameter; illustrative, in `scenarios/city-scenarios.ts`.

## How to view

Operator Console → preset **Barcelona · Evacuation (case study)**, or
`?scenario=barcelona`. **Walk Route** rides the corridor at eye level.

## Provenance & ethics

OpenStreetMap © contributors, ODbL 1.0 — attribution required. Retrospective /
education modelling exercise; the evacuation overlay is illustrative and not for
operational use. See `docs/P7-MARIUPOL-PREP.md` §5.
