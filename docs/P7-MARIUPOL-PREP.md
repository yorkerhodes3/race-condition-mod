# P7 Preparation — Mariupol Site Pack (research + plan)

Research-backed plan for standing up the **second site** (Mariupol) end-to-end on
the scenario seams built in P0–P6. Sources: the
[Ethical-Tech-CoLab](https://github.com/Ethical-Tech-CoLab) (ETC) org, whose
evacuation work centers on the siege of Mariupol (Mar–May 2022).

> **Not operational.** Like ETC's own work, this is a **retrospective, open-data,
> IHL-anchored planning/education** simulation. It must not ingest live
> individual-location data and must not be usable to locate or interdict people
> (RFC §7). Movement/data fusion that aids evacuation can also aid targeting —
> this constraint is load-bearing, not a footnote.

---

## 1. What the seams need vs. what ETC provides

The engine now reads seven data seams (all default to Vegas, all render-identical
until a pack opts in):

| Seam (phase) | File | Mariupol source (ETC) |
|---|---|---|
| Site — geo + GLB (P0) | `scenarios/site.ts` | anchor **47.10°N, 37.55°E**; geometry from `mariupol_lights.json` (45,544 OSM building centroids) → OSM-extruded mesh (no photogrammetry GLB exists) |
| Theme — tone (P1) | `scenarios/theme.ts` | siege palette: amber route / red danger / green shelter (RFC §4.5), muted vs. Vegas neon |
| POI taxonomy (P2) | `scenarios/poi.ts` | `danger_zone` from `unosat_mariupol_damage.json` (783 structures 14 Mar; 5,647 structures 7–12 May); shelters / assembly points from OSM |
| Route (P3) | `scenarios/route.ts` | the negotiated **humanitarian corridor** route (schematic front-line map). **Mariupol v1 = single route** (per decision 2026-07-29) |
| Group cohesion (P4) | `scenarios/group.ts` | households move together; roles (child/elder/assisted) inform pace + vulnerability weighting |
| Mingling / info (P5) | `scenarios/mingling.ts` | `infoNoise` knob ← India-EvacSimulation (decisions under intelligence uncertainty) + Evac-Sim-Melanie (information spread) |
| Speed / mode (P6) | `scenarios/mode.ts` | Mariupol siege = mostly `foot`; `bus`/`car` where corridors permitted |

## 2. ETC repositories and how each maps in

- **[mariupol-evacuation-model](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model)**
  (primary; HTML/static, forked from `ChristineLumen/mariupol-evacuation-model`).
  - **Severity** `S` = generalised power mean (p=6, weakest-link) of six
    normalised components (hostility intensity, kinetic proximity, protection
    risk, cold burden, deprivation clock, infrastructure damage) × vulnerability
    weight (Vw = 1.114), classified into **five phases**. → drives
    `danger_zone.severity` and hazard intensity over time.
  - **Feasibility**: UNOSAT damage points + VIIRS nighttime-light collapse across
    four evacuation windows. → time-varying `danger_zone` intensity + which
    corridor windows are viable.
  - **Data files to adapt**: `unosat_mariupol_damage.json` (damage markers),
    `mariupol_lights.json` (building centroids), `docs/METHODOLOGY.md` (formulas).
  - **IHL anchor**: GC IV art. 17 (negotiated evacuation). Corridor regimes and
    their routes are already modelled per-date.
- **[India-EvacSimulation](https://github.com/Ethical-Tech-CoLab/India-EvacSimulation)** —
  how field-intelligence **uncertainty** degrades evacuation decisions. →
  calibrates P5 `infoNoise` and the "cost of bad information" story.
- **[Evac-Sim-Melanie](https://github.com/Ethical-Tech-CoLab/Evac-Sim-Melanie)** —
  agent-based **information spread + demographics**. → P4 group roles + P5 belief
  update (`blendBelief`).
- **[ercf](https://github.com/Ethical-Tech-CoLab/ercf)** (ERCF, Python) —
  Evacuation Risk & Cost Framework. → post-run cost/risk readout; severity→risk
  weighting.
- **[CERAI_AR](https://github.com/Ethical-Tech-CoLab/CERAI_AR)** — Monte Carlo
  evacuation model. → multi-run over seed sets; ties into the golden-run harness
  (`goldenRunSignature` per seed).
- **[Exodus](https://github.com/Ethical-Tech-CoLab/Exodus)** (FastAPI) — unifies
  EII + ERCF + CERAI. → candidate backend/control-plane integration for a live
  (non-cached) Mariupol run.
- **[evacuation-inform-index-carolina](https://github.com/Ethical-Tech-CoLab/evacuation-inform-index-carolina)**
  (EII) — INFORM Severity crisis map. → normalizes `danger_zone.severity` onto a
  standard humanitarian scale.
- **[haste](https://github.com/Ethical-Tech-CoLab/haste)** — satellite tracking
  for emergencies (geospatial ML). → hazard/damage data pipeline.
- **[after-the-corridor-report](https://github.com/Ethical-Tech-CoLab/after-the-corridor-report)**
  — post-evacuation outcomes (Dzaleka/Malawi). → framing for "after the corridor".

## 3. Site Pack layout to author (`scenarios/mariupol/`)

Per RFC §4.1:

```
scenarios/mariupol/
  site.json      # anchor {lat:47.10, lon:37.55}, GLB path + transform, projection
  routes.geojson # ONE corridor LineString + start(muster)/finish(exit) markers
  pois.geojson   # danger_zones (UNOSAT), shelters, assembly points
  theme.json     # siege palette (amber/red/green), muted tone
  copy.json      # labels ("Evacuation" not "Marathon")
  assets/models/mariupol.glb  # OSM-extruded block from mariupol_lights.json
```

Then register `mariupol` in each seam's registry (`SITES`, `THEMES`, `ROUTES`,
etc.) and select via `?scenario=mariupol` / `window.ENV.SCENARIO`.

## 4. Data acquisition & transform steps

1. **Geometry**: `mariupol_lights.json` (45,544 centroids) → generate a simple
   extruded-block mesh (or instanced boxes) → export `mariupol.glb`. The engine
   only needs *a* mesh + transform; footprints/heights can be OSM-derived.
2. **Danger zones**: `unosat_mariupol_damage.json` → cluster damage points into
   `danger_zone` POI polygons with `severity` from the model's phase for the date.
3. **Route**: extract the negotiated corridor polyline (single LineString) →
   `routes.geojson` with `route_type:"evacuation"`, `role:"corridor"`,
   `from:"danger_zone_*"`, `to:"exit_*"`.
4. **Projection**: reuse the anchor-relative `lngLatToWorld` (already generic;
   only the anchor changes).
5. **Time axis (optional v2)**: map the model's daily severity/feasibility to a
   scenario clock so hazards evolve across the siege windows.

## 5. Ethics / guardrails (blocking gate — RFC §7)

Must hold before P7 ships:
- Retrospective + open-data + synthetic-where-needed only; **no live individual
  location data**; not usable to locate/interdict people.
- IHL-anchored framing (GC IV art. 17); parties'-conduct summaries **descriptive
  and attributed** (OCHA/ICRC/OHCHR/UNOSAT), not adjudicative.
- Vulnerability-prioritized routing only (never de-prioritize anyone); never
  present a single route as guaranteed-safe.
- Honor upstream provenance/attribution: `CITATION.cff`, UNOSAT code
  CE20220223UKR, NASA VIIRS, ACLED, OSM, ERA5; note the fork lineage
  (`ChristineLumen/mariupol-evacuation-model`) and licensing before vendoring any
  data.

## 6. Open items before building P7

1. **Licensing** of each data file (UNOSAT/ACLED/OSM/VIIRS terms) — confirm we
   may vendor or must fetch at runtime.
2. **GLB pipeline** — pick the centroid→mesh tool and target poly budget (must
   render 1000+ agents within the current tick budget; RFC §9).
3. **Corridor geometry** — extract the exact single-route polyline + endpoints
   from the model's schematic map (georeferenced).
4. **Severity→hazard mapping** — how the 6-component / 5-phase score parameterizes
   `danger_zone.severity` and (v2) its time evolution.
5. **Backend scope** — cached-only Mariupol replay first (like Vegas), or wire
   Exodus/ERCF for a live control plane later.
6. **Validation** — extend the golden-run harness with a Mariupol config so the
   swap has a deterministic signature and can't silently regress Vegas.

## 7. Suggested P7 execution order

1. Author `scenarios/mariupol/` data (site/route/pois/theme/copy) with a
   placeholder OSM-extruded GLB.
2. Register `mariupol` in all seam registries; verify `?scenario=vegas` is byte
   -identical and `?scenario=mariupol` loads.
3. Wire danger zones + single corridor; keep groups/mingling/mode at conservative
   defaults; add a Mariupol golden-run signature.
4. Ethics review sign-off (§5) before making Mariupol the default or publicizing.

## 8. Status (updated 2026-07-30)

**Done — Mariupol scaffolding is in the seam registries (render-identical Vegas).**
Opt-in via `?scenario=mariupol` (and the matching `theme/route/groups/mingle/
movement` ids); Vegas remains the default and is byte-identical (existing parity
guards still pass).

- `scenarios/site.ts` — `MARIUPOL_SITE` (anchor 47.0958/37.5497, **no GLB yet →
  schematic**). `viewport/scene/scene.ts` now loads the city GLB only when a site
  provides one, so a schematic site renders without crashing.
- `scenarios/theme.ts` — `MARIUPOL_SIEGE_THEME` (muted, low-glow).
- `scenarios/route.ts` — `MARIUPOL_CORRIDOR_ROUTE` (`evacuation`/`corridor`,
  single, non-loop; `distanceMi` estimated 141).
- `scenarios/group.ts` — `MARIUPOL_HOUSEHOLDS` (cohesion 0.85).
- `scenarios/mingling.ts` — `MARIUPOL_SIEGE_MINGLING` (dwell + `infoNoise` 0.4).
- `scenarios/mode.ts` — `MARIUPOL_MIXED` (foot + bus).
- `testing/golden-run.ts` — `MARIUPOL_GOLDEN_CONFIG` + a deterministic signature
  guard distinct from Vegas.
- `public/console.html` — the Operator Console lists all Mariupol ids.

**Still gated (needs data/licensing + ethics sign-off before it truly renders):**
1. **City mesh** — produce the OSM-extruded GLB from `mariupol_lights.json` and
   set `MARIUPOL_SITE.glbPath` (until then Mariupol is schematic — no buildings).
2. **Corridor geometry + danger zones** — real `routes.geojson` (single corridor
   polyline) and `pois.geojson` (UNOSAT damage → danger zones); today the route
   is metadata-only (the rendered path still comes from the gateway/cached
   routes).
3. **Licensing** of UNOSAT/ACLED/OSM/VIIRS data before vendoring (§6).
4. **Ethics review sign-off** (§5) — **blocking** before Mariupol is made a
   default, published, or shown with real data.

## 9. Wired (updated 2026-07-30)

Ethics/data-sensitivity sign-off received. The **schematic render pipeline is now
wired** and Mariupol renders (opt-in) without a GLB:

- `scenarios/geo.ts` — pure, tested projection (`makeProjector`) + defensive
  GeoJSON/building parsing (`parseBuildings` / `parseCorridor` / `parsePois`).
- `scenarios/site.ts` — `Site.data` (`buildingsUrl` / `routeUrl` / `poisUrl`);
  `MARIUPOL_SITE.data` points at the pack files.
- `viewport/scene/schematic-site.ts` — builds extruded building blocks, the
  amber corridor tube, and colored POI markers (danger=red / shelter=green /
  assembly=amber / checkpoint=blue). Called from `initModel` only when a site
  has no GLB; Vegas never calls it.
- `public/scenarios/mariupol/` — **representative synthetic** `buildings.json`
  (144 footprints), `route.geojson` (one corridor), `pois.geojson` (6 POIs), and
  a provenance `README.md`.

**Remaining = a data drop-in (no code change):** overwrite the three pack files
with real, appropriately-licensed ETC data (OSM centroids → `buildings.json`,
UNOSAT damage → `pois.geojson`, georeferenced corridor → `route.geojson`) and,
for a true skyline, add an OSM-extruded GLB and set `MARIUPOL_SITE.glbPath`.
Camera framing for the Mariupol scale may need a visual pass on the deployed
site (the fly cameras were tuned for Vegas).
