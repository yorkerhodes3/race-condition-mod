# Autonomous Run Report — Evacuation Twin Foundations (P0 → P1 → P2)

**Author:** GitHub Copilot (autonomous session)
**Repo:** `yorkerhodes3/race-condition-mod` (fork of GoogleCloudPlatform/race-condition)
**Branch:** `main`
**Live site:** https://yorkerhodes3.github.io/race-condition-mod/
**Companion RFC:** [docs/DESIGN-CHANGES-SITE-Purpose.md](DESIGN-CHANGES-SITE-Purpose.md)

---

## 1. Mandate

Work autonomously and methodically to implement the first three phases of the
location-swappable evacuation-twin refactor described in the design RFC. Each
phase must:

1. Render Las Vegas **identically** (no visible change to the demo).
2. Be **tested** and pass full regression before moving on.
3. Land as **one clean commit** on `main`, gated by CI.

Constraint (from the RFC's phased rollout): every change is an *extraction* of
hard-coded Las Vegas values into a data-driven "pack" seam, so that a second
site (e.g. an evacuation scenario) can later be dropped in without touching the
render pipeline.

---

## 2. What shipped

| Phase | Title | Commit | CI | Result |
|---|---|---|---|---|
| P0 | Site Pack (geo + GLB) | `2f44d3f` | run 30421974650 | ✅ green |
| P1 | Theme Pack (visual tone) | `cdc23ec` | run 30422482673 | ✅ green |
| P2 | POI taxonomy | `103047d` | run 30422917300 | ✅ green |

All three phases are additive/extractive refactors. The Vegas render is
byte-for-byte unchanged because every extracted default equals the literal that
was previously inlined.

### P0 — Site Pack (`2f44d3f`)

Introduced [web/frontend/src/app/scenarios/site.ts](../web/frontend/src/app/scenarios/site.ts)
as the single source of truth for **where** the simulation is anchored and
**which** 3D model renders.

- `Site` interface: `{ id, name, mapCenter{lat,lon}, glbPath, glbTransform }`.
- `VEGAS_SITE` holds the exact pre-refactor constants: map center
  `36.1085, -115.1769`, model `models/Google_LasVegas_Export_v32.glb`, and the
  GLB transform (`scale 0.1`, offsets, `rotationY 0`).
- `getActiveSite()` resolves from `?scenario=` query param, then
  `window.ENV.SCENARIO`, defaulting to `vegas`. Guarded for node/vitest.
- Rewired consumers to read from the pack:
  [viewport/config.ts](../web/frontend/src/app/viewport/config.ts) (map center),
  [road-network.ts](../web/frontend/src/app/road-network.ts) (removed a duplicate
  `MAP_CENTER` copy — now sourced from `config.ts`),
  [glb-roads.ts](../web/frontend/src/app/glb-roads.ts) (GLB transform), and
  [viewport/scene/scene.ts](../web/frontend/src/app/viewport/scene/scene.ts)
  (GLB path).
- Added a vitest harness ([vitest.config.ts](../web/frontend/vitest.config.ts),
  node environment, `scenarios/**` only) plus
  [scenarios/site.spec.ts](../web/frontend/src/app/scenarios/site.spec.ts) as a
  constant-equality parity guard.
- Added a **Test Frontend** step to CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml))
  running `npm run test:vitest` after the frontend build.

### P1 — Theme Pack (`cdc23ec`)

Introduced [web/frontend/src/app/scenarios/theme.ts](../web/frontend/src/app/scenarios/theme.ts)
as the single source of truth for the **visual tone** (the "Vegas neon night"
look).

- `Theme` interface: `{ id, name, bloom{strength,radius,threshold},
  roadEmissive{color,intensity}, windowGlowColor }`.
- `VEGAS_NEON_THEME` holds the exact pre-refactor literals:
  bloom `(0.12, 0.5, 0.02)`, road emissive `0x334455 @ 0.4`, window glow
  `0xb0bcbf`.
- `getActiveTheme()` resolves from `?theme=` then `window.ENV.THEME`, defaulting
  to `vegas-neon`.
- Rewired consumers:
  [viewport/scene/postprocessing.ts](../web/frontend/src/app/viewport/scene/postprocessing.ts)
  (UnrealBloomPass params),
  [glb-roads.ts](../web/frontend/src/app/glb-roads.ts) (road emissive), and
  [viewport/shaders/height-fog-shader.ts](../web/frontend/src/app/viewport/shaders/height-fog-shader.ts)
  (window glow color).
- Added [scenarios/theme.spec.ts](../web/frontend/src/app/scenarios/theme.spec.ts)
  parity guard.

### P2 — POI taxonomy (`103047d`)

Introduced [web/frontend/src/app/scenarios/poi.ts](../web/frontend/src/app/scenarios/poi.ts)
as the single source of truth for **point-of-interest types**.

- `BASE_POI_TYPES` = the four Vegas station types, **order-locked**:
  `water_station, medical_tent, crowd_zone, portable_toilet`.
- `EVAC_POI_TYPES` = additive evacuation set (reserved, never instantiated for
  Vegas): `shelter, danger_zone, assembly_point, triage, checkpoint,
  aid_station, supply`.
- `PoiType` union, `POI_TYPES` composite, `isBasePoiType()` guard.
- Rewired [water-station.ts](../web/frontend/src/app/water-station.ts):
  `StationZone.stationType` and `SimpleStationZone` now use `PoiType`.
- Added [scenarios/poi.spec.ts](../web/frontend/src/app/scenarios/poi.spec.ts)
  parity guard asserting the base four are unchanged and in order.

Render-identity holds because the evacuation types are never constructed for the
Vegas site, and the runner's station `switch` already has a `default` branch, so
widening the type introduces no behavioral change.

---

## 3. How render-identity was proven

Because the local environment cannot run the Angular/Go/Python suites (no
Docker, wrong Python minor, restricted npm feed), validation leaned entirely on
**CI** plus **static guarantees**:

1. **Constant-equality vitest guards** (new this run) — pure, no-three/no-DOM
   spec files assert every extracted default equals the exact literal it
   replaced. These run in CI via the new *Test Frontend* step. If any Vegas
   constant drifts, the build goes red.
2. **`npm run build` (Angular/TS compile)** — the primary frontend gate. All
   rewired imports and widened unions type-check. `tsconfig.app.json` excludes
   `*.spec.ts`, so specs never affect the shipped bundle.
3. **`make lint` + Go tests + Python tests** — unchanged and green each phase,
   confirming no cross-language regressions.
4. **Read-only extraction discipline** — each phase only moves a literal behind
   a getter whose default returns that same literal. No pipeline logic changed.

### Manual screenshot checklist (for human review)

Since pixels can't be diffed locally, please spot-check the live site after the
next Pages deploy. Expected: **no visible difference** from before.

- [ ] Camera frames the Strip at the same map center (P0).
- [ ] Las Vegas GLB loads at the same scale/offset/rotation (P0).
- [ ] Bloom intensity on neon looks unchanged; no over/under-glow (P1).
- [ ] Road surfaces retain the subtle blue emissive (P1).
- [ ] Building windows retain the pale-cyan glow (P1).
- [ ] Water stations, medical tents, crowd zones, porta-potties render and
      behave exactly as before (P2).

---

## 4. Seams now in place

```
web/frontend/src/app/scenarios/
├── site.ts     # WHERE  — geo anchor + GLB model + transform     (P0)
├── theme.ts    # LOOK   — bloom + emissive tone                  (P1)
└── poi.ts      # WHAT   — point-of-interest taxonomy             (P2)
```

Each pack is pure (no three.js / no DOM), overridable via query param or
`window.ENV`, defaults to the Vegas values, and is protected by a vitest parity
guard. Together they form the foundation a second site plugs into.

---

## 5. Risks / notes

- The evacuation POI types (P2) are declared but have **no renderers or
  interaction handlers** yet — that is intentional and deferred to P3+. They are
  inert for Vegas.
- `road-shader.ts` also contains an emissive literal (`0xb0bcbf`) that was left
  untouched to keep P1 minimal; fold it into the Theme Pack in a later pass if
  desired.
- CI cycle is ~7–9 min; each phase was pushed and watched to green before the
  next began (fail-stop discipline: keep `main` green).

---

## 6. Recommended next work

The RFC's later phases build on these seams. Suggested order (each still
render-identical for Vegas):

1. **P3 — Route model** ([RFC §4.2](DESIGN-CHANGES-SITE-Purpose.md)): extract the
   marathon polyline into a `Route` abstraction (waypoints + width + closure
   semantics) so an evacuation corridor can replace the loop. Highest leverage;
   unblocks staged-GO and speed/mode work.
2. **P4 — Group cohesion** ([RFC §4.6](DESIGN-CHANGES-SITE-Purpose.md)): model
   family/household grouping so agents move as cohesive units, not independent
   runners.
3. **P5 — Mingling / assembly** ([RFC §4.7](DESIGN-CHANGES-SITE-Purpose.md)):
   dwell-and-mingle behavior at assembly points.
4. **P6 — Speed / mode** ([RFC §4.9](DESIGN-CHANGES-SITE-Purpose.md)): per-agent
   locomotion modes (walk/run/assisted/vehicle).
5. **P7 — Second Site Pack** ([RFC §6](DESIGN-CHANGES-SITE-Purpose.md)): author a
   non-Vegas `Site` + `Theme` + evacuation POIs and flip via `?scenario=`, giving
   the first true side-by-side of the twin.

My recommendation: **do P3 (Route model) next.** It is the last big hard-coded
Vegas assumption in the render/sim path, and P4–P6 all read cleaner once routes
are data. Keep the same cadence — one commit per phase, vitest parity guard for
each extracted constant, watch CI to green before advancing.

---

## 7. Commit index

| Commit | Summary |
|---|---|
| `05523f8` | Multi-provider embeddings adapter + GPU model-plane overlay + evacuation RFC (pre-run) |
| `2f44d3f` | P0: extract Site Pack |
| `cdc23ec` | P1: extract Theme Pack |
| `103047d` | P2: extract POI taxonomy |
