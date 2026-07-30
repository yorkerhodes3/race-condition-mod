# Mariupol Site Pack data (representative / synthetic)

These files back the schematic Mariupol scenario (`?scenario=mariupol`). They are
**representative synthetic data**, authored in-repo for the simulation's
geometry — **not** real building footprints, damage assessments, or corridor
coordinates.

| File | What it is |
|---|---|
| `buildings.json` | A synthetic grid of ~144 building footprints (`{lon,lat,height}`) around the city anchor, for the schematic block skyline. |
| `route.geojson` | One representative evacuation-corridor `LineString` (city center → northwest exit). |
| `pois.geojson` | A handful of representative `Point` POIs: assembly point, danger zones, shelters, a corridor checkpoint. |

## Replacing with real data (gated)

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
