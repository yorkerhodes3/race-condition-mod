# Mariupol Site Pack data (mixed: captured stats + synthetic geometry)

These files back the schematic Mariupol scenario (`?scenario=mariupol`). The
**zone cohort statistics are captured real figures** (see below); the
**geometry** (building footprints, exact zone placements, corridor coordinates)
is still **representative** — positioned around the city anchor for the schematic,
not surveyed.

| File | What it is |
|---|---|
| `buildings.json` | A synthetic grid of ~144 building footprints (`{lon,lat,height}`) around the city anchor, for the schematic block skyline. |
| `route.geojson` | One representative evacuation-corridor `LineString` (EXIT WEST → Zaporizhzhia direction). |
| `pois.geojson` | Zone/corridor POIs: the **five real emergency-zone cohorts** (with captured population/vulnerable/child/elderly/disabled + damage/dark/destroyed and a `tag`), plus EXIT WEST, the Zaporizhzhia destination, Bezimenne filtration, Azovstal, and a shelter. |

## Captured (real) data now in the pack

The zone cohorts in `pois.geojson` and `src/app/scenarios/mariupol-data.ts` are
**transcribed real figures** from the ETC / Christine Lumen
`mariupol-evacuation-model` "Data-Driven Evacuation Analysis" (Late Mar–Apr 2022)
and the 16 Mar 2022 severity model:

- **Five emergency zones** summing to the published **37,663 exposed** /
  **16,102 vulnerable** (Zone 5's child/elderly/disabled split is estimated to
  its exact vulnerable total; the source row is truncated).
- Scenario facts: severity **0.54** (Phase 3/5), pre-siege pop **343,598**,
  **~16%** damaged, **22%** lights, **783** UNOSAT points, **45,544** buildings,
  corridor **227 km** to Zaporizhzhia (in-city Dijkstra route **7.0 km**).

Still synthetic/geometry-only: `buildings.json` footprints and the exact zone
lon/lat placements (positioned around the anchor for the schematic, not surveyed).

## Replacing the remaining synthetic geometry (gated)

The engine consumes generic shapes (see `scenarios/geo.ts`), so real,
appropriately-licensed data can drop in **without code changes** by overwriting
these files:

- **Buildings** — OSM building centroids (e.g. ETC's `mariupol_lights.json`,
  45,544 points) mapped to `{lon,lat,height}` or `{centroid:[lon,lat]}`.
- **Danger zones** — UNOSAT damage points (e.g. `unosat_mariupol_damage.json`,
  UNOSAT code CE20220223UKR) clustered into `danger_zone` POIs.
- **Corridor** — the georeferenced negotiated-corridor polyline.

## Provenance & ethics

Source models and datasets: ETC
[mariupol-evacuation-model](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model)
(open data, IHL-anchored). Any real data added here must honor its upstream
licensing and attribution (UNOSAT / ACLED / NASA VIIRS / OpenStreetMap / ERA5),
be descriptive-and-attributed rather than adjudicative, and remain a
**retrospective planning/education** artifact — never operational, never keyed to
live individual location. See `docs/P7-MARIUPOL-PREP.md` §5–§6.
