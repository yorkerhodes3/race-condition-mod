# Design Changes — From Marathon to Evacuation Twin

> Status: **Proposal / RFC.** Nothing here is implemented yet. This document is
> the deliberate design record for repurposing Race Condition from a *Las Vegas
> neon marathon* simulation into a *location‑swappable evacuation* simulation,
> and for making the swap a first‑class, data‑driven capability rather than a
> fork.
>
> Scope owner: this fork ([yorkerhodes3/race-condition-mod](https://github.com/yorkerhodes3/race-condition-mod)).
> Companion docs: [docs/deployment-harnesses.md](deployment-harnesses.md),
> the DTSF twin under [dtsf/packs/race-condition/](../dtsf/packs/race-condition/).

---

## 1. Purpose

Race Condition already models **thousands of autonomous agents moving along a
route through a real 3‑D city**, coordinated by a gateway, planned by GIS/agent
tooling, and rendered in a WebGL viewport. That is structurally the same problem
as **civilian evacuation**: many people, imperfect information, shared routes,
bottlenecks, stopping points, and a clock.

The goal of this design is to change *what the simulation is about* — a marathon
becomes an evacuation — **without forking the engine**. Concretely we want to be
able to:

1. **Move the location.** Swap Las Vegas for another city (worked example:
   **Mariupol, Ukraine**) by changing data + config, not code.
2. **Change the route semantics.** A marathon route (fixed loop, festive) becomes
   an **evacuation route** (away from a hazard, toward shelter/exit corridors).
3. **Change the stopping points.** Water stations / medical tents / toilets become
   **shelters, assembly points, triage, checkpoints, aid distribution** — and
   **danger zones** to avoid.
4. **Change the tone.** The neon‑night "spectacle" theme becomes a muted, urgent,
   legible evacuation theme — via a swappable **Theme Pack**, not shader edits.
5. **Model people as people.** Agents cluster into **families / friend groups**
   that move together, **wait for each other** before starting, and **mingle**
   (exchange information, hesitate, regroup) at decision points.
6. **Model how they move.** A per‑agent **speed** distribution (walk vs run) and a
   **movement mode** (on foot / car / bus / train) with different speeds,
   capacities, and route constraints.

This work is grounded in the evacuation research of the **[Ethical Tech CoLab
(ETC)](https://github.com/orgs/Ethical-Tech-CoLab/repositories)** — see
§8 for the specific projects and frameworks we adopt, and §7 for the ethical
guardrails that must hold before any of this ships.

### 1.1 Non‑goals / hard boundaries

- **Not an operational targeting or tracking tool.** This is a *planning and
  education* simulation over open/synthetic data. It must not ingest live
  individual‑location data, and must not be usable to locate or interdict people.
  (See §7.) This mirrors ETC's stance in
  [mariupol-evacuation-model](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model)
  (open data, IHL‑anchored, *briefing* tool).
- **Not a fork.** Every change below is either (a) new data/config a "pack"
  supplies, or (b) a new *optional* engine capability that defaults to today's
  marathon behavior. The Vegas demo must keep working unchanged.

---

## 2. Design principles

1. **Data over code.** A "scenario" is data: a **Site Pack** (geometry + geo
   anchor + routes + POIs) and a **Theme Pack** (tone). The engine reads packs;
   it does not hardcode Vegas.
2. **Additive & backward‑compatible.** New fields default to current behavior.
   Marathon = the default scenario. Evacuation = another scenario.
3. **Deterministic & reproducible.** Preserve the existing seeded determinism
   (DTSF twin seed `42`, seeded IDs) so scenarios are auditable and comparable.
4. **Dignity first, capability second.** People are modeled as families with
   agency, not as particles to be optimized. Vulnerability is represented to
   *prioritize protection*, never to rank people for exclusion. (§7.)
5. **Honest uncertainty.** Evacuation decisions happen under bad information;
   the model should *show* uncertainty rather than imply false precision — the
   core lesson of ETC's
   [India-EvacSimulation](https://github.com/Ethical-Tech-CoLab/India-EvacSimulation).

---

## 3. Current architecture inventory (what is Vegas‑specific today)

Before proposing abstractions, here is the concrete inventory of everything that
currently hardcodes "Las Vegas marathon." Each row is a seam we must generalize.

| Concern | Where it lives today | Vegas‑specific fact |
|---|---|---|
| City geometry | [web/frontend/src/app/viewport/scene.ts](../web/frontend/src/app/viewport/scene.ts) (`GLTFLoader`) | loads `assets/models/Google_LasVegas_Export_v32.glb` |
| Model transform | [web/frontend/src/app/viewport/glb-roads.ts](../web/frontend/src/app/viewport/glb-roads.ts) (`GLB_TRANSFORM`) | scale/offset/`rotationY` tuned to the Vegas GLB |
| Geo anchor | [web/frontend/src/app/viewport/config.ts](../web/frontend/src/app/viewport/config.ts) | `MAP_CENTER_LAT = 36.1085`, `MAP_CENTER_LON = -115.1769` |
| Geo→world projection | [web/frontend/src/app/viewport/icons.ts](../web/frontend/src/app/viewport/icons.ts) (`lngLatToWorld`), `viewport-lookdev` (`geoToWorld`) | Mercator around the Vegas anchor |
| Routes (rendered) | [web/frontend/cached_routes/](../web/frontend/cached_routes/) `cache-{1,2,3}.json` | GeoJSON: start/finish markers, `route_type:"marathon"`, `distance_mi`, POIs |
| Routes (planned) | [agents/planner/skills/gis-spatial-engineering/scripts/tools.py](../agents/planner/skills/gis-spatial-engineering/scripts/tools.py) | `_STRIP_HUB`, `_build_strip_corridor`, `_place_portable_toilets` (~3.1 mi) |
| POI types | [web/frontend/src/app/water-station.ts](../web/frontend/src/app/water-station.ts) (`StationZone`) | union: `water_station \| medical_tent \| crowd_zone \| portable_toilet` |
| POI rendering | [web/frontend/src/app/viewport/icons.ts](../web/frontend/src/app/viewport/icons.ts) | `getWaterZone` / `getMedicalZone` / `getPortableToiletZone` / `getCrowdZone`, `tickZones` |
| POI interaction | [web/frontend/src/app/runner.ts](../web/frontend/src/app/runner.ts) (`checkStations` → `onEnterStation`) | runner drinks/heals at stations |
| Theme / post‑fx | [web/frontend/src/app/viewport/postprocessing.ts](../web/frontend/src/app/viewport/postprocessing.ts), `road-shader.ts`, `height-fog-shader.ts`, `glb-roads.ts` | Bloom + LUT + vignette, emissive `0x334455`, window glow — "neon night" |
| Labels / copy | [web/frontend/src/app/constants.ts](../web/frontend/src/app/constants.ts), [web/frontend/src/app/demo-config.ts](../web/frontend/src/app/demo-config.ts) | "Las Vegas Neon Night Marathon", "Vegas Strip Marathon Plan" |
| Agent movement | [agents/runner/running.py](../agents/runner/running.py) (`process_tick`), [agents/runner/constants.py](../agents/runner/constants.py) | velocity·hydration·wall·fatigue; `NATURAL_FATIGUE_RATE`, `SPEED_SCALE` |
| Agent init | [agents/runner/initialization.py](../agents/runner/initialization.py) | lognormal running velocity |
| Runner state | ADK `tool_context.state` dict | `velocity/distance/water/exhausted/collapsed/finished/…` — **no group, no mode, no position** |
| Frontend agent | [web/frontend/src/app/runner.ts](../web/frontend/src/app/runner.ts) (`Runner`, `RunnerManager`) | Catmull‑Rom interp at `t = distanceMi / MARATHON_DISTANCE_MI` |
| Start semantics | gateway `POST /api/v1/spawn`; [agents/simulator/](../agents/simulator/) `pre_race_callback` | 5‑phase: prepare→spawn→collector→`fire_start_gun`→done; broadcast `START_GUN` |

**Key structural facts that make this feasible:**

- Agent *progress* is derived from a scalar `distance` along a path, not an (x,y).
  Position is `path.interpolate(distance / total)`. Swapping the path swaps the
  world without touching agent physics.
- POIs are already a **typed union + a registry + a per‑tick check**. Adding
  evacuation POI types is an extension of an existing pattern, not a new system.
- Start is already an explicit **staged, broadcast event** (`START_GUN`). "Wait
  for your family, then GO" is a generalization of that staging.

---

## 4. Proposed abstractions

Each subsection: **the idea → the seam it touches → the minimal change → default.**

### 4.1 Site Pack (location swap: Vegas → Mariupol)

**Idea.** A *Site Pack* is a self‑contained folder describing one place:

```
scenarios/<id>/
  site.json           # geo anchor, GLB path + transform, projection params
  routes.geojson      # LineStrings + start/exit markers (see 4.2)
  pois.geojson        # shelters, assembly points, danger zones (see 4.3)
  theme.json          # Theme Pack ref (see 4.5)
  copy.json           # labels/titles ("…Marathon" vs "…Evacuation")
  assets/models/*.glb # city geometry
```

**Seam.** Today `scene.ts`, `glb-roads.ts` (`GLB_TRANSFORM`),
`viewport/config.ts` (`MAP_CENTER_*`), and `icons.ts` (`lngLatToWorld`) each read
hardcoded constants.

**Change.** Introduce `site.json` and a small `loadSite(id)` that populates:
`glbUrl`, `glbTransform`, `mapCenter {lat,lon}`, `projection`. `scene.ts` /
`glb-roads.ts` / `config.ts` read from the loaded site instead of module
constants. Scenario id comes from `window.ENV.SCENARIO` (runtime‑repointable,
same mechanism as `NG_APP_GATEWAY_ADDR` today) with a `?scenario=` override.

**Default.** `SCENARIO=vegas` reproduces today's constants exactly (the current
values become `scenarios/vegas/site.json`).

**Mariupol specifics.** `mapCenter ≈ {lat: 47.0958, lon: 37.5497}`; supply a
Mariupol GLB (or a flat OSM‑extruded tile block if no photogrammetry GLB exists —
the engine only needs *a* mesh + a transform). The projection math
(`lngLatToWorld`) is anchor‑relative and already generic; only the anchor changes.

### 4.2 Route model (marathon loop → evacuation corridors)

**Idea.** A marathon route is one closed LineString the whole field follows. An
evacuation has **multiple directed corridors** leading *away from a hazard* toward
*exits/shelters*, and agents choose among them.

**Seam.** Rendered routes: `cached_routes/cache-*.json` (GeoJSON with
`route_type:"marathon"`). Planned routes: planner `tools.py`
(`_build_strip_corridor`, hub‑anchored). Frontend path use:
`Runner` interpolates a single assigned path by `distance`.

**Change (data).** Extend the route GeoJSON vocabulary:

```jsonc
// Feature.properties
{ "route_type": "evacuation",         // was "marathon"
  "role": "corridor",                  // corridor | approach | contraflow
  "from": "danger_zone_1",             // hazard this route leads away from
  "to": "shelter_3",                   // destination POI id
  "modes": ["foot","car","bus"],       // which movement modes may use it (4.9)
  "capacity_per_min": 1200,            // for bottleneck modeling
  "distance_km": 4.2 }
```

Start/exit markers reuse the existing `marker-type` Point convention
(`start` → **origin/muster**, `finish` → **exit/safe area**).

**Change (planner).** Generalize the Vegas‑hub route builder into a
`build_evacuation_routes(danger_zones, destinations, graph)` that runs
shortest/safest paths *away from* danger polygons toward destination POIs. Keep
`_build_strip_corridor` as the marathon strategy behind a `route_type` switch.

**Change (agent assignment).** Each agent gets an assigned corridor (by home
location → nearest viable exit). Progress stays scalar `distance` along the
assigned LineString — **no change to the interpolation core.**

**Default.** `route_type:"marathon"` → today's single‑loop behavior.

**Re‑routes (planned, decided 2026‑07‑29).** Agents may re‑select their corridor
at decision points (forks / assembly points / checkpoints) when their current
route becomes `blocked` (see 4.7). This is an **additive** engine capability,
gated on having ≥2 candidate corridors. **Mariupol v1 defines a single route**,
so re‑routing is a no‑op there — the capability lands first and real branching
data follows. Vegas (one loop) is likewise unaffected.

### 4.3 Stopping‑location taxonomy (stations → shelters/aid/danger)

**Idea.** Generalize the POI type union and its effects.

**Seam.** [water-station.ts](../web/frontend/src/app/water-station.ts) `StationZone.stationType`
union; `icons.ts` `getWaterZone/getMedicalZone/…` + `registerZone` + `tickZones`;
`runner.ts` `checkStations` → `onEnterStation`.

**Change.** Extend the union and add renderers + effects:

| New POI type | Effect on agent (evacuation) | Analogue today |
|---|---|---|
| `shelter` | safe endpoint; agent "sheltered", removed from exposure | `finish` |
| `assembly_point` | muster/regroup; families wait for members (4.6) | `crowd_zone` |
| `triage` / `aid_station` | restores condition; may impose queue/delay | `medical_tent` |
| `checkpoint` | throughput limit + delay (document/queue) | (new) |
| `water_point` / `supply` | restores condition | `water_station` |
| `danger_zone` (polygon) | **repels** routing; raises risk if entered | (new) |

`danger_zone` is the important inversion: existing POIs *attract* (agents seek
water); danger zones *repel* (routing avoids them; entry raises an agent's risk
metric). Represent as a polygon Feature with `type:"danger_zone"` +
`severity` (see §8 INFORM/EII).

**Default.** The four marathon types keep their exact current effects.

### 4.4 (folded into 4.3)

### 4.5 Theme Pack (neon spectacle → muted urgency)

**Idea.** Tone is a swappable Theme Pack, not shader edits. The engine already
centralizes look‑dev, so this is config extraction.

**Seam.** [postprocessing.ts](../web/frontend/src/app/viewport/postprocessing.ts)
(Render→SSAO→Bloom→LUT→Vignette), `glb-roads.ts` emissive `0x334455`,
`road-shader.ts`, `height-fog-shader.ts` window glow `0xB0BCBF`, plus copy in
`constants.ts` / `demo-config.ts`.

**Change.** `theme.json`:

```jsonc
{ "bloom":   { "strength": 0.15, "threshold": 0.9 },  // dialed WAY down
  "lut":     "assets/luts/neutral-day.cube",           // not neon
  "vignette":{ "intensity": 0.2 },
  "emissive":{ "roads": "0x1a1a1a", "windows": "0x000000" }, // no glow
  "palette": { "route": "#f2c200", "danger": "#c0392b", "shelter": "#2ecc71" },
  "labels":  "legible-high-contrast" }
```

`postprocessing.ts` reads these instead of literals. Two shipped themes:
`vegas-neon` (today) and `evac-muted` (low bloom, neutral LUT, high‑contrast
legible labels, danger=red / route=amber / shelter=green — colorblind‑safe).

**Default.** `vegas-neon` = today's exact values.

**Ethical note.** The evacuation theme must be *sober*, not dramatized. No
"spectacle" framing of human displacement. This is an explicit design constraint,
not a style preference (§7).

### 4.6 Group cohesion (families / friend groups move together)

**Idea.** Agents belong to a **group** (household / friend cluster). Group members
(a) start together, (b) try to stay within a cohesion radius, (c) wait/regroup at
assembly points, (d) share information (4.7). Cohesion is the single most
important behavioral change for realism — real people do **not** evacuate as
independent particles.

**Seam.** Runner state dict has no group concept. `RunnerManager` is a flat
`Map<guid, Runner>`. `process_tick` computes per‑agent `effective_velocity`.

**Change (state).** Add to agent state:

```jsonc
{ "group_id": "hh_0042",
  "group_role": "adult|child|elder|caregiver|assisted",
  "cohesion_target": 0.8,     // how tightly this group stays together
  "leader": true }
```

**Change (physics).** In `process_tick`, add a cohesion term: an agent's
`effective_velocity` is additionally throttled toward the **slowest active group
member** within its corridor (a family moves at the pace of its slowest member,
modulated by `cohesion_target`). This is a multiplicative factor alongside the
existing hydration/wall/fatigue factors — same shape, no rewrite.

**Change (frontend).** `RunnerManager` groups by `group_id` for rendering (shared
color/tint, optional connective hint). Purely additive.

**Default.** `group_id = self`, `cohesion_target = 0` → independent agents =
today's behavior.

### 4.7 Mingling / information at decision points

**Idea.** At **decision points** (route forks, assembly points, checkpoints)
agents **mingle**: they pause, exchange information, and update beliefs — which
route is open, where the danger moved, whether to wait. This is the mechanism ETC's
[Evac-Sim-Melanie](https://github.com/Ethical-Tech-CoLab/Evac-Sim-Melanie)
(information spread + demographics) and
[India-EvacSimulation](https://github.com/Ethical-Tech-CoLab/India-EvacSimulation)
(decisions under intelligence uncertainty) both center on.

**Seam.** `checkStations`/`onEnterStation` already fire when an agent enters a
zone — decision points reuse this trigger. Agent state already flows through
per‑tick callbacks.

**Change.** A `mingle` stochastic parameter per agent (`0..1`): probability that,
on reaching a decision point, the agent (a) dwells for `dwell_ticks`, (b) samples
information from co‑located group/agents (belief update on which corridor is
`open`/`blocked`), (c) possibly re‑routes. Model information as **noisy**: each
agent holds an estimate of danger/route‑openness with error that mingling
*reduces* (crowd wisdom) but rumor can *bias* (crowd panic). Expose the noise
level as a scenario knob so the sim can *show* the cost of bad information — the
explicit lesson of India‑EvacSim.

**Default.** `mingle = 0` → agents pass decision points without dwelling =
today's behavior.

### 4.8 Start / GO semantics (staging: wait for your family, then go)

**Idea.** Generalize `START_GUN` into a **staged GO**: groups **stage** at origin,
become **ready** only when all members are present, and then **GO** — either all at
once (siren) or in **waves** (staggered release to prevent crush).

**Seam.** [agents/simulator/](../agents/simulator/) `pre_race_callback` 5‑phase
sequence: prepare→spawn→collector→`fire_start_gun`→done; `fire_start_gun`
broadcasts `START_GUN`; runners initialize velocity on first tick after.

**Change.** Insert a **staging phase** before GO:
`prepare → spawn → **assemble** → collector → GO(wave?) → done`. In `assemble`,
grouped agents wait at origin until `all_members_present || timeout`. `GO`
supports `mode: "mass" | "wave"` with `wave_interval` and `wave_size` (staggered
release). `START_GUN` becomes `GO_SIGNAL` with a `wave_id`; the marathon maps to
`mode:"mass"`.

**Default.** `mode:"mass"`, no staging (groups of one) → `START_GUN` today.

### 4.9 Speed & movement mode (walk/run; foot/car/bus/train)

**Idea (speed).** Replace "everyone runs" with a per‑agent speed drawn from a
distribution spanning **walk → run** (elders/children/assisted at the low end).

**Idea (mode).** Each agent/group has a **movement mode** with distinct speed,
capacity, and *route eligibility*:

| Mode | Speed band | Capacity | Route constraint |
|---|---|---|---|
| `foot` | walk–run | 1 | any corridor |
| `car` | fast, but jams | ~4 | road corridors only; subject to `capacity_per_min` (4.2) |
| `bus` | medium, scheduled | ~40 | designated corridors + stops |
| `train` | fast, fixed | ~hundreds | rail lines + stations only |

**Seam.** `initialization.py` draws a lognormal *running* velocity;
`constants.py` has `SPEED_SCALE`; `process_tick` advances `distance +=
effective_velocity · SPEED_SCALE · minutes_per_tick`.

**Change.** Generalize initialization to draw from a **mode‑conditioned** speed
distribution (walk band for pedestrians, road‑speed for cars with a jam factor
tied to corridor occupancy). Add `mode` to agent state; gate corridor
eligibility by `Feature.properties.modes` (4.2). Capacity/jam reuses
`capacity_per_min`: when corridor occupancy > capacity, apply a congestion
multiplier to `effective_velocity` — again, same multiplicative shape.

**Default.** Single `foot` mode + the current lognormal → today's runners.

---

## 5. Data‑model change summary

**Agent state (additive fields):** `group_id`, `group_role`, `cohesion_target`,
`leader`, `mingle`, `mode`, `assigned_corridor`, `risk` (exposure metric),
`sheltered`. All default so that omitting them reproduces marathon behavior.

**GeoJSON vocabulary (additive):** route `role/from/to/modes/capacity_per_min`;
POI types `shelter/assembly_point/triage/checkpoint/aid_station/supply`; polygon
`danger_zone{severity}`.

**Config / packs (new):** `scenarios/<id>/{site,theme,copy}.json`,
`routes.geojson`, `pois.geojson`; runtime selector `window.ENV.SCENARIO` +
`?scenario=`.

**Frontend types:** extend `StationZone` union; group‑aware `RunnerManager`
rendering; site‑driven `scene/glb-roads/config`.

**No change to:** the scalar‑distance progress core, the gateway REST surface,
the DTSF twin contract, or the seeded‑determinism model.

---

## 6. Phased rollout

1. **P0 — Site Pack extraction (no behavior change).** Move Vegas constants into
   `scenarios/vegas/*`; add `loadSite`. Ship; Vegas demo identical. *Lowest risk,
   unlocks everything.*
2. **P1 — Theme Pack + copy.** Extract post‑fx/copy; add `evac-muted`. Pure look.
3. **P2 — POI taxonomy + danger zones.** Extend union/renderers/effects.
4. **P3 — Evacuation routes.** Route vocabulary + planner
   `build_evacuation_routes`; agent corridor assignment.
5. **P4 — Groups + staging GO.** Cohesion term + assemble phase + waves.
6. **P5 — Mingling + information.** Decision‑point dwell + noisy beliefs.
7. **P6 — Speed/mode + capacity.** Mode‑conditioned speeds + congestion.
8. **P7 — Second Site Pack (Mariupol).** Prove the swap end‑to‑end on real,
   open, IHL‑anchored data (§8).

Each phase is independently shippable and defaults to prior behavior, so CI stays
green and the demo never regresses.

---

## 7. Ethical considerations (guardrails, not footnotes)

Grounded in ETC's [what-is-ethical-ai](https://github.com/Ethical-Tech-CoLab/what-is-ethical-ai)
and the evacuation portfolio. These are **gating requirements**, not nice‑to‑haves.

- **Purpose limitation / anti‑dual‑use.** Planning & education only. No live
  individual tracking, no target‑generation. The model consumes **open or
  synthetic** hazard/route data (as
  [mariupol-evacuation-model](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model)
  does), never personal location feeds. Document this in the README and refuse
  feature requests that cross it.
- **Dignity, not spectacle.** The `evac-muted` theme is mandatory for evacuation
  scenarios; no gamified/festival framing of displacement. Copy is sober and
  person‑first ("people", "families", not "targets"/"units").
- **Vulnerability to protect, never to exclude.** `group_role`
  (elder/child/assisted) exists to model who needs *more* help and to prioritize
  accessible routes/shelters — never to deprioritize anyone. Any ranking output
  must be framed as "who to help first," and this must be stated in‑product.
- **Honest uncertainty.** Show confidence intervals / information noise (4.7);
  never present a single route as guaranteed‑safe. Mirrors India‑EvacSim's whole
  thesis: field‑intelligence uncertainty degrades decisions, and pretending
  otherwise is harmful.
- **Structural accountability.** Because this is a *twin* (DTSF), keep the seeded,
  reproducible, auditable trace so any scenario can be re‑run and reviewed. Log
  assumptions (hazard model, capacities) as data, not hidden constants.
- **Consent & provenance of place data.** City geometry and route data must be
  used within license; cite sources per Site Pack. Prefer OSM / open data.
- **Red‑team before real use.** Before any non‑synthetic scenario, run an
  adversarial review: could this output, if leaked, harm the people it depicts?
  If yes, it does not ship.

---

## 8. Recommended additional elements (from the ETC evacuation work)

Concrete, high‑leverage additions, each mapped to an existing ETC project so we
reuse frameworks instead of inventing them.

1. **Hazard severity via INFORM / EII.** Drive `danger_zone.severity` and route
   risk from an **INFORM Severity**–style index rather than an ad‑hoc number. ETC's
   [evacuation-inform-index-carolina](https://github.com/Ethical-Tech-CoLab/evacuation-inform-index-carolina)
   (EII) already renders INFORM severity + live conflict timelines — adopt its
   scoring as our hazard input schema.
2. **IHL‑anchored protected features.** From
   [mariupol-evacuation-model](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model):
   tag hospitals/schools/humanitarian corridors as **protected** POIs and model
   **safe‑corridor** windows (time‑bounded openings). Our `checkpoint` +
   `wave` GO map naturally onto negotiated corridor windows.
3. **Risk‑&‑cost scoring (replace the "marathon score").** ETC's
   [ercf](https://github.com/Ethical-Tech-CoLab/ercf) (Evacuation Risk & Cost
   Framework) estimates human + financial cost of evacuation. Use ERCF as the
   simulation's *objective/score*: instead of "runner experience," report
   people‑sheltered, exposure‑minutes, and cost — a far more meaningful readout.
4. **Monte‑Carlo uncertainty bands.** ETC
   [CERAI_AR](https://github.com/Ethical-Tech-CoLab/CERAI_AR) (Monte‑Carlo
   evacuation model) motivates running each scenario **N times** with varied
   seeds/noise and reporting distributions, not point estimates — pairs directly
   with our seeded determinism and the mingling noise knob (4.7).
5. **Information‑spread behavioral model.** Adopt the agent behavior model of
   [Evac-Sim-Melanie](https://github.com/Ethical-Tech-CoLab/Evac-Sim-Melanie)
   (how information spread + demographics shape evacuation behavior) as the basis
   for §4.7 mingling and §4.6 group decisions.
6. **Decision‑under‑uncertainty dynamics.** Adopt
   [India-EvacSimulation](https://github.com/Ethical-Tech-CoLab/India-EvacSimulation)'s
   core variable — *field‑intelligence uncertainty* — as a first‑class scenario
   knob that degrades belief accuracy and thus route choice.
7. **Unified data platform integration.** ETC's
   [Exodus](https://github.com/Ethical-Tech-CoLab/Exodus) (FastAPI unifying EII +
   ERCF + CERAI) is a natural **upstream data source**: our DTSF twin (already an
   HTTP request/response Express service) could fetch hazard/cost/risk layers from
   an Exodus‑style endpoint instead of static files — clean seam, no engine change.
8. **Satellite / remote‑sensing hazard input.** ETC
   [haste](https://github.com/Ethical-Tech-CoLab/haste) (High‑speed Assessment &
   Satellite Tracking for Emergencies) suggests a future `danger_zone` provider
   derived from remote sensing — kept strictly to *area/hazard* layers, never
   individuals (§7).
9. **Post‑evacuation continuity.** ETC
   [after-the-corridor-report](https://github.com/Ethical-Tech-CoLab/after-the-corridor-report)
   reminds us the story doesn't end at the exit: model `shelter` capacity and
   onward flow (reception → onward movement) so "sheltered" isn't treated as
   "solved."

### Suggested new scenario knobs (summary)

`hazard_severity_source` (inform|static), `information_noise` (0..1),
`monte_carlo_runs` (N), `corridor_window` (time‑bounded openings),
`vulnerability_priority` (accessible‑route weighting), `reunification`
(family‑reunification objective), `shelter_capacity_model` (on|off).

---

## 9. Open questions / risks

- **Geometry availability.** Is there a usable Mariupol GLB, or do we extrude OSM?
  (Engine only needs a mesh + transform, so OSM extrusion is an acceptable P7 v1.)
  *Decision (2026‑07‑29):* the second site is **Mariupol**; its route / POI /
  hazard data and geometry are sourced from ETC's
  [mariupol-evacuation-model](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model)
  (open, IHL‑anchored). Not vendored in this repo yet — P7 imports/adapts it.
- **Vector‑dimension coupling.** Memory embeddings assume `VECTOR(3072)`; unrelated
  to scenarios but relevant when swapping embedding providers (see
  [docs/deployment-harnesses.md](deployment-harnesses.md)).
- **Congestion realism vs performance.** Corridor‑occupancy congestion at 1000+
  agents must stay within the current tick budget; may need coarse spatial bins.
- **Determinism with mingling.** Stochastic mingling must draw from the seeded RNG
  to preserve reproducibility (CERAI‑style multi‑run then depends only on seed set).
- **Data ethics review sign‑off** (§7) is a *blocking* gate for any real‑place,
  non‑synthetic scenario.

---

## 10. Appendix — seam reference index

Fast index from concept → file to touch (all default to marathon behavior):

- Location → [scene.ts](../web/frontend/src/app/viewport/scene.ts) ·
  [glb-roads.ts](../web/frontend/src/app/viewport/glb-roads.ts) ·
  [viewport/config.ts](../web/frontend/src/app/viewport/config.ts) ·
  [icons.ts](../web/frontend/src/app/viewport/icons.ts)
- Routes → [cached_routes/](../web/frontend/cached_routes/) ·
  [gis-spatial-engineering/scripts/tools.py](../agents/planner/skills/gis-spatial-engineering/scripts/tools.py)
- POIs → [water-station.ts](../web/frontend/src/app/water-station.ts) ·
  [icons.ts](../web/frontend/src/app/viewport/icons.ts) ·
  [runner.ts](../web/frontend/src/app/runner.ts)
- Theme → [postprocessing.ts](../web/frontend/src/app/viewport/postprocessing.ts) ·
  [constants.ts](../web/frontend/src/app/constants.ts) ·
  [demo-config.ts](../web/frontend/src/app/demo-config.ts)
- Movement → [running.py](../agents/runner/running.py) ·
  [constants.py](../agents/runner/constants.py) ·
  [initialization.py](../agents/runner/initialization.py) ·
  [runner.ts](../web/frontend/src/app/runner.ts)
- Start/GO → [agents/simulator/](../agents/simulator/) · gateway `POST /api/v1/spawn`
