# Paris — evacuation case-study scenario

**Modelling exercise, not operational.** Real building geometry with an
illustrative evacuation model, so we can compare "best case" data availability
against the harder Mariupol case. Opt-in via `?scenario=paris`.

## What is real vs. illustrative (fidelity)

| Layer | File | Fidelity | Source |
|---|---|---|---|
| Buildings | `buildings.json` | **HIGH — real** | 3,842 OpenStreetMap building-footprint centroids, Overpass `way["building"]` over the Marais / Île de la Cité / Bastille district (bbox 48.850,2.340 → 48.864,2.366). © OpenStreetMap contributors (ODbL). |
| Population zones | `pois.geojson` | Illustrative | 5 origin zones placed at real named neighbourhoods (Le Marais, Île de la Cité, Bastille, Beaubourg, Hôtel de Ville). Positions approximate; not survey cells. |
| Exits | `pois.geojson` | Illustrative | 2 exits (Rue de Rivoli/Louvre west; Gare de Lyon east) at plausible egress edges. |
| Corridor | `route.geojson` | Illustrative | One representative corridor (centre → Exit West along Rue de Rivoli). A straight-ish schematic line, **not** a routed street path. |
| Demographics | `pois.geojson` | Synthetic | 12,000 people split across the 5 zones; ~40% vulnerable (children + elderly + disabled), internally consistent (guarded by `city-scenarios.spec.ts`). |

## The model (targets)

- **Population moved:** 12,000 (Z1 2,600 · Z2 2,200 · Z3 2,600 · Z4 2,400 · Z5 2,200).
- **Vulnerable:** 4,800 (40%).
- **Zones:** 5 origin cohorts, each tagged `paris-z1..z5` and colour-coded; agents
  carry their zone tag through the animation.
- **Exits:** 2; each zone's evacuees funnel to the **nearest** exit.
- **Family cohesion:** 0.78 (avg household size 2.1) — a movement-constraint
  parameter (households move together); illustrative, documented in
  `scenarios/city-scenarios.ts`.

## How to view

Operator Console → preset **Paris · Evacuation (case study)**, or
`?scenario=paris`. Opens on a random origin close-up; **Walk Route** rides the
corridor at eye level to inspect buildings along the way.

## Provenance & ethics

OpenStreetMap © contributors, ODbL 1.0 — attribution required. This is a
retrospective/education modelling exercise; the evacuation overlay is
illustrative and must not be used operationally or keyed to live individuals.
See `docs/P7-MARIUPOL-PREP.md` §5 and `docs/MARIUPOL-REAL-TERRAIN-PLAN.md`.
