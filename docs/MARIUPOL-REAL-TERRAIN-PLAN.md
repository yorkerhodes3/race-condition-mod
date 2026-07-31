# Mariupol — Real Terrain & City Build-Out Plan

**Goal.** Take the Mariupol scenario from its current *schematic* render (instanced
boxes + labeled corridor + animated evacuees) to something that reads like the
**Las Vegas** scene: real ground **terrain**, real **city buildings**, and the
ability to **"walk the route."** Do it using only the **same limited-use
privileges** the ETC / Christine Lumen work relies on — open, retrospective,
attributed, non-operational data (OSM, Copernicus, SRTM, Sentinel-2, VIIRS,
UNOSAT public releases). No commercial/live-location data.

> Non-operational, retrospective, open-data only. Same guardrails as
> [P7-MARIUPOL-PREP.md](P7-MARIUPOL-PREP.md) §5. This plan is about **assets**, not
> new intelligence.

---

## 1. The target: how Las Vegas gets its look (reference architecture)

Knowing what LV does tells us exactly what to source for Mariupol.

| Ingredient | Las Vegas today | Where in code |
|---|---|---|
| City geometry | One photogrammetry mesh `Google_LasVegas_Export_v32.glb` | `scenarios/site.ts` `VEGAS_SITE.glbPath`; loaded in `viewport/scene/scene.ts` `initModel` (GLTFLoader + Meshopt) |
| World placement | `glbTransform` (scale/offset/rotation) + anchor-relative Mercator | `scenarios/site.ts`, `scenarios/geo.ts` `makeProjector` |
| Ground / mountains / sky | Big ground plane + skybox + mountain band | `viewport/scene/scene.ts` `initGround` |
| Lit windows / neon | Custom shaders (window/road/height-fog) + bloom LUT | `viewport/shaders/*`, `viewport/scene/postprocessing.ts` |
| Route line | `CatmullRomCurve3` spline → tube; drawn progressively | `viewport/route/route.ts`, `viewport-lookdev` `currentSpline` |
| "People on the route" | Runner agents follow the spline; follow-cameras ride them | `viewport-lookdev` `followLeader` / `followRandomRunner`, `FOLLOW_RUNNER_OFFSET` |

Mariupol already has the **schematic** equivalents (buildings/corridor/POIs +
evacuee flow in `viewport/scene/schematic-site.ts`) and can accept a real GLB via
`MARIUPOL_SITE.glbPath`. The work below fills the three gaps: **terrain**,
**building shells**, and a **walkable route camera**.

---

## 2. Asset layers to source

### A. Ground terrain (elevation)

Mariupol is coastal and mostly flat, so terrain is about a believable base surface
+ coastline, not dramatic relief.

| Source | License / privilege | Use |
|---|---|---|
| **Copernicus GLO-30 DEM** (30 m) | Free, ESA/Copernicus attribution | Primary elevation grid |
| **NASA/USGS SRTM 30 m** | Public domain | Fallback elevation |
| **AWS Terrain Tiles** (Tilezen/Mapzen, terrarium PNG) | Open (attribution) | Easy web-tile heightmap, no account |
| OSM coastline / `natural=water` | ODbL | Sea of Azov shoreline mask |

**Output:** a heightmap (GeoTIFF → normalized PNG) covering the Mariupol bbox
(~`47.05,37.45 → 47.20,37.65`). Feed into a displaced `PlaneGeometry` (see §5).

### B. City buildings (footprints + heights)

| Source | License / privilege | Use |
|---|---|---|
| **OpenStreetMap buildings** (Overpass) | ODbL (attribution + share-alike) | Primary footprints + `height`/`building:levels` |
| **Microsoft Global ML Building Footprints** | ODbL | Fill gaps where OSM is sparse |
| Google Open Buildings | CC BY-4.0 | *Check coverage* — weak for Ukraine; likely skip |
| **UNOSAT CE20220223UKR** damage points | UN public release, attribution | Per-building damage tint / `danger_zone` |
| **NASA VIIRS Black Marble** (VNP46A2) | Public domain | "Lit/dark" per district tint |

**Overpass query (footprints + heights):**
```
[out:json][timeout:120];
way["building"](47.05,37.45,47.20,37.65);
out geom;
```
Convert each polygon → either (i) `{lon,lat,height}` centroid for the existing
`buildings.json` (instanced boxes, cheap), or (ii) an **extruded footprint** in a
GLB (real shells, §C). Height = `height` tag, else `building:levels × 3 m`, else
default 15 m.

### C. Turn footprints into a city mesh (the GLB)

Pick one toolchain (all open):

| Tool | Notes |
|---|---|
| **osm2world** (LGPL) | OSM → 3D `.obj/.gltf`; batch-friendly, headless |
| **Blender + Blosm/blender-osm** | OSM buildings+terrain+satellite in one; export glTF |
| **QGIS + Qgis2threejs** | Extrude footprints by height, export glTF/scene |
| **F4Map / OSM Buildings** | Reference visuals only (not vendorable) |

**Compression:** run the export through **gltfpack** (meshoptimizer) — the engine
already loads Meshopt-compressed GLBs (`MeshoptDecoder` in `scene.ts`). Target a
**poly/draw-call budget** that keeps 1000+ agents within the current tick budget
(P7-PREP §9): merge by material, drop interiors, LOD distant blocks.

**Output:** `public/assets/models/mariupol.glb` → set `MARIUPOL_SITE.glbPath`.

### D. Textures / imagery (optional realism pass)

| Source | License / privilege | Use |
|---|---|---|
| **Sentinel-2** (Copernicus) | Free, attribution | Ground/satellite basemap texture (open alt to Esri) |
| Esri Wayback World Imagery | Esri terms — *display only* | Christine uses it; for a Google demo prefer Sentinel-2 to avoid provider-terms friction |
| Generic PBR facade atlases (CC0) | CC0 | Building facade texturing in the GLB |

Keep imagery **retrospective** (siege-window dates) if used for damage/darkness
storytelling, consistent with the model.

### E. Damage & darkness overlays (reuse existing seams)

UNOSAT damage → `pois.geojson` `danger_zone` (already wired) **and** a per-building
red tint on the GLB; VIIRS darkness → dim emissive on unlit districts. This is
where "real data" meets the existing severity story without new geometry.

---

## 3. "Walk the route" capability

Two things are needed: a **georeferenced corridor** and a **camera that travels
it at human scale**.

1. **Corridor geometry (data).** Replace the representative
   `public/scenarios/mariupol/route.geojson` with the georeferenced
   Mariupol→Zaporizhzhia corridor (OCHA/ICRC route via Manhush–Berdyansk–
   Tokmak–Vasylivka) as an ordered `LineString`. `parseCorridor` already consumes
   the first LineString; the schematic builds the spline from it. For an in-city
   "walk," also capture the **street path** from the origin zones to EXIT WEST
   (OSM `highway=*` routing, or hand-digitized).
2. **Road network (optional, for true streets).** LV has a road-network layer
   (`road-network.ts`). A Mariupol equivalent can be generated from OSM
   `highway=*` ways for street-level context under the walk camera.
3. **Walk camera (small engine addition).** Add a **street-level camera mode**
   that rides the corridor spline: sample `curve.getPointAt(t)` for position and
   `curve.getTangentAt(t)` for look-ahead, at eye height (~1.7 world-units above
   terrain), advancing `t` over time. This mirrors LV's runner-follow cameras
   (`followLeader`/`FOLLOW_RUNNER_OFFSET`) but follows the **route** instead of a
   runner. Wire it as a 4th console camera button ("Walk") and a keyboard shortcut.
   Reuse the evacuee curves already built in `schematic-site.ts` `addEvacuees`
   (they are exactly origin→exit→corridor paths) — expose one as the walk path.

---

## 4. Pipeline (concrete, offline)

A single offline script produces the drop-in assets; **no runtime deps, no license
issue** because outputs are attributed derived data.

```
scripts/mariupol/                     # proposed (offline, not shipped to the app)
  fetch_osm_buildings.py    # Overpass → buildings.geojson (+ heights)
  fetch_dem.py              # Copernicus/SRTM → mariupol_dem.tif → heightmap.png
  fetch_unosat.py           # UNOSAT release → damage.geojson → pois danger_zones
  build_buildings_json.py   # buildings.geojson → public/scenarios/mariupol/buildings.json
  build_route_geojson.py    # OCHA corridor → public/scenarios/mariupol/route.geojson
  extrude_to_glb.py|.blend  # buildings.geojson (+DEM) → mariupol.glb (gltfpack)
```
Python stack: `overpy`/`osmnx` (OSM), `rasterio`/`elevation` (DEM), `shapely`
(geometry), Blender/osm2world (mesh), `gltfpack` (compression). Outputs map 1:1 to
files the engine **already reads**.

---

## 5. Engine changes required (small, isolated to the schematic path)

Vegas stays byte-identical; all of this is behind the GLB-less / schematic branch
or additive.

1. **Terrain mesh** — in `viewport/scene/schematic-site.ts`, replace the flat
   `addGround` plane with an optional **displaced terrain** built from a
   `Site.data.terrainUrl` heightmap (add the field to `SiteData`). Fall back to
   the flat plane when absent (today's behavior). Coastline mask from OSM water.
2. **GLB wiring** — set `MARIUPOL_SITE.glbPath` once `mariupol.glb` exists;
   `scene.ts` already prefers a GLB and falls back to schematic. Add a
   `glbTransform` tuned to the Mariupol anchor/scale (update `site.spec.ts`, which
   currently asserts `MARIUPOL_SITE.glbPath` is undefined).
3. **Walk camera** — add `cameraWalk()` in `viewport-lookdev` that follows the
   corridor curve (position + tangent, eye height over terrain), plus a console
   button + shortcut. Expose the corridor curve from `schematic-site.ts`.
4. **Road network (optional)** — a Mariupol OSM street layer if we want true
   street-level under the walk camera.

---

## 6. Phasing (crawl → walk → run)

| Phase | Deliverable | Look vs. LV |
|---|---|---|
| **P-A · Real footprints** | OSM `buildings.json` (real centroids + heights) replaces synthetic 144 | City massing is real; still boxes |
| **P-B · Terrain** | DEM heightmap → displaced ground + Azov coastline | Ground reads as real terrain |
| **P-C · City GLB** | osm2world/Blender extruded `mariupol.glb` + `glbPath` | Real building shells, LV-like skyline |
| **P-D · Walk the route** | Georeferenced corridor + walk camera | Can travel the route at human scale |
| **P-E · Realism pass** | Sentinel-2 ground texture, UNOSAT damage tint, VIIRS darkness | Siege-accurate atmosphere |

Each phase is independently shippable and keeps CI/Pages green.

---

## 7. Licensing & attribution (must ship with the scenario)

| Data | License | Attribution string |
|---|---|---|
| OSM buildings/roads/water | ODbL 1.0 | "© OpenStreetMap contributors" |
| Copernicus GLO-30 DEM | Copernicus free | "Contains modified Copernicus data" |
| SRTM | Public domain | "NASA/USGS SRTM" |
| Sentinel-2 | Copernicus free | "Contains modified Copernicus Sentinel data" |
| VIIRS Black Marble | Public domain | "NASA VIIRS Black Marble" |
| UNOSAT damage | UN public, attribution | "UNITAR/UNOSAT CE20220223UKR" |
| Model lineage | — | "after ChristineLumen/Ethical-Tech-CoLab mariupol-evacuation-model" |

Put these in `public/scenarios/mariupol/README.md` (already the provenance home)
and a scenario credits panel. Confirm **vendor-vs-fetch-at-runtime** per source
(P7-PREP §6.1) before committing any raw data.

---

## 8. Risks / notes

- **Poly budget** is the main technical risk: a full OSM extrusion of Mariupol can
  be heavy. Merge-by-material + LOD + gltfpack; measure against the 1000-agent
  tick budget before wiring `glbPath`.
- **Provider terms**: prefer Copernicus/SRTM/Sentinel-2/OSM over Mapbox/Maxar/
  Planet/Esri to stay inside the "limited-use / open" privilege the ETC work uses.
- **Ethics**: this is asset realism, not new targeting capability — keep it
  retrospective and attributed; never present a route as guaranteed-safe
  (P7-PREP §5).
- **Vegas parity**: every change lives behind the schematic/GLB-less branch or is
  additive; the Vegas render and all parity guards stay green.
