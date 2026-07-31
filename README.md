# Race Condition — Evacuation Twin (fork)

> **This is a fork of [`GoogleCloudPlatform/race-condition`](https://github.com/GoogleCloudPlatform/race-condition).**
> It repurposes the upstream multi-agent *marathon* simulation into a
> location-swappable *civilian evacuation* twin, and ships a set of real-city
> case-study scenarios that run entirely in the browser.
>
> The complete upstream documentation is preserved verbatim in
> **[README.upstream.md](README.upstream.md)** — read that for the backend, the
> agents, local setup (`make init` / `make start`), and cloud deployment. This
> file only describes **what this fork adds** and **what is still in progress**.

[![Deploy frontend to GitHub Pages](https://github.com/yorkerhodes3/race-condition-mod/actions/workflows/pages.yml/badge.svg)](https://github.com/yorkerhodes3/race-condition-mod/actions/workflows/pages.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Live (offline) demo:** https://yorkerhodes3.github.io/race-condition-mod/ —
static build, no backend, no API keys, no cost.

---

## Why this fork exists

Upstream models *thousands of autonomous agents moving along a route through a
real 3-D city*. That is structurally the same problem as **civilian
evacuation**: many people, imperfect information, shared routes, bottlenecks,
stopping points, and a clock.

This fork changes *what the simulation is about* — a marathon becomes an
evacuation — **without forking the engine's behaviour**. Vegas still renders
identically; every new scenario is opt-in via a `?scenario=<id>` URL parameter
and a data pack. The design record is
[docs/DESIGN-CHANGES-SITE-Purpose.md](docs/DESIGN-CHANGES-SITE-Purpose.md)
(an RFC — see *Work in progress* below for what is and isn't built yet).

The evacuation framing is grounded in the open, IHL-anchored research of the
[Ethical Tech CoLab](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model).
It is a **planning and education** tool over open/synthetic data — **not** an
operational tracking or targeting tool. See *Fidelity & ethics* below.

## What this fork adds

- **A location-swappable schematic scenario framework** —
  [`web/frontend/src/app/scenarios/`](web/frontend/src/app/scenarios/). A `Site`
  registry keyed by `?scenario=<id>`; each scenario is pure data (building
  footprints, routes, POIs, damage) rendered by a GLB-less schematic renderer
  ([`schematic-site.ts`](web/frontend/src/app/viewport/scene/schematic-site.ts)).
- **A "Mariupol" evacuation twin** — real ETC/OSM geometry, a humanitarian
  corridor, danger/shelter zones, and family-cohort evacuees.
- **Four real-city case-study scenarios** (Paris, Barcelona, Venice, NYC) — real
  OpenStreetMap building footprints with an illustrative 5-zone / 2-exit /
  12,000-person evacuation model each.
- **The NYC Marathon route** — an approximate polyline of the real TCS 5-borough
  course, shipped for comparison against the upstream Vegas Strip marathon.
- **A "Walk Route" eye-level camera** — glides smoothly to the corridor start
  and rides it at eye level so you can inspect the buildings along the way.
- **Operator Console presets** for every scenario
  ([`web/frontend/public/console.html`](web/frontend/public/console.html)).

### New demo artefacts

Each scenario is a self-contained pack under
[`web/frontend/public/scenarios/<id>/`](web/frontend/public/scenarios/):

| Scenario | `?scenario=` | Buildings (real OSM) | Model | Notes |
| --- | --- | --- | --- | --- |
| Mariupol | `mariupol` | ETC + OSM centroids | evacuation corridor + damage | retrospective twin |
| Paris | `paris` | 3,842 | 5 zones / 2 exits / 12k | Marais · Île de la Cité · Bastille |
| Barcelona | `barcelona` | 4,243 | 5 zones / 2 exits / 12k | Ciutat Vella |
| Venice | `venice` | 4,438 | 5 zones / 2 exits / 12k | exits at the real land egress |
| NYC | `nyc` | 2,568 | 5 zones / 2 exits / 12k | + `marathon.geojson` |

Each pack carries a `README.md` documenting **sources and per-layer fidelity**,
and every registered city is guarded by
[`city-scenarios.spec.ts`](web/frontend/src/app/scenarios/city-scenarios.spec.ts)
(zone counts, population = 12,000, consistent vulnerable split, real buildings,
a corridor). A shared registry
([`city-scenarios.ts`](web/frontend/src/app/scenarios/city-scenarios.ts)) is the
source of truth for each city's targets and provenance.

## How it works offline today

The whole point of the fork's deliverable is that it runs with **zero backend**:

1. **Static build on GitHub Pages.** The Angular frontend is built in CI
   ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)) and served as a
   static site. (The build runs in CI because the local npm registry is blocked
   behind a corporate feed.)
2. **Cached replay** (inherited from upstream). The default mode replays recorded
   NDJSON runs — real timing, real agent output, no network.
3. **Schematic scenarios are pure data.** Buildings (`buildings.json`), routes
   and POIs (`*.geojson`), and damage (`damage.json`) are fetched and rendered
   client-side. No LLM, no gateway, no database — the evacuation *visualisation*
   is fully self-contained.

So today the fork delivers the **rendered scenarios and the camera/console UX**
offline. It does **not yet** drive those scenarios from the live multi-agent
backend (see below).

## Dependencies on other systems

| Capability | Depends on | Needed for |
| --- | --- | --- |
| Rendered scenarios + cached replay | Nothing (static site) | The offline demo — works today |
| Building geometry | OpenStreetMap via Overpass API (ODbL) | Regenerating scenario packs (already vendored) |
| Mariupol data | [Ethical Tech CoLab](https://github.com/Ethical-Tech-CoLab/mariupol-evacuation-model) (open data) | The Mariupol twin |
| Live multi-agent mode | Upstream backend: Go gateway, Python ADK agents, Vertex AI, AlloyDB, Redis, Pub/Sub | Driving any scenario live (upstream feature) |
| Route planning with live maps | Google Maps MCP + API key (upstream) | The planner's geographic routes |
| Static deploy | GitHub Actions + GitHub Pages | Publishing the offline demo |

Satellite imagery is **link-out only** (Esri Wayback provider terms); this fork
does not re-host tiles.

## Work in progress — what's left (mostly backend)

The **frontend** evacuation *visualisation* is implemented and shipping. The
**backend** evacuation *behaviour* is largely still an RFC
([DESIGN-CHANGES-SITE-Purpose.md](docs/DESIGN-CHANGES-SITE-Purpose.md)). Open
threads, roughly in priority order:

- **Wire scenarios into the live engine.** Today scenarios render as schematic
  data; the Go gateway / ADK agents still run the Vegas marathon. Make the
  simulator load a Site Pack and drive evacuees along the evacuation corridor.
- **Evacuation agent semantics.** Family/friend cohorts that move together, wait
  for each other, and mingle at decision points; per-agent speed (walk vs run)
  and movement mode (foot/car/bus/train). Currently a modelled parameter
  (`cohesion`), not agent behaviour.
- **Hazard-aware routing.** Shelters, assembly points, triage, and **danger
  zones** that actually influence agent decisions (not just POIs on a map).
- **DTSF twin control plane.** Drive the deployed app's REST control plane
  ([`dtsf/packs/race-condition/`](dtsf/packs/race-condition/)) so Live mode can
  target an evacuation scenario without a rebuild.
- **Building visual fidelity** — tracked as
  [**VIS-1 (#20)**](https://github.com/yorkerhodes3/race-condition-mod/issues/20)
  and in [docs/BACKLOG.md](docs/BACKLOG.md): real OSM heights → footprint
  polygons → satellite drape → photorealistic 3D tiles. Today buildings are real
  footprints with **hashed heights only** (no facade/satellite texture).
- **Marathon distance fidelity.** The NYC Marathon polyline is ~37.4 km of
  straight chords vs. the official 42.195 km (~88%); the surveyed GPX centreline
  would close the gap.

See [docs/BACKLOG.md](docs/BACKLOG.md) and the
[issue tracker](https://github.com/yorkerhodes3/race-condition-mod/issues) for
the running list.

## Fidelity & ethics

- **Real:** OpenStreetMap building footprints (© OpenStreetMap contributors,
  ODbL). Every pack's `README.md` labels each layer HIGH / MEDIUM / illustrative.
- **Illustrative / synthetic:** zones, exits, evacuation corridors, and all
  demographics (the 12,000-person split, ~40% vulnerable). Building heights are
  hashed, not real storeys.
- **Boundaries:** a planning/education modelling exercise over open/synthetic
  data. **Not** operational; must not ingest live individual-location data; must
  not be used to locate or interdict people. Mirrors the ETC stance. See
  [docs/P7-MARIUPOL-PREP.md](docs/P7-MARIUPOL-PREP.md) §5.

## Relationship to upstream

This is a derivative work under the **Apache License 2.0** (see [LICENSE](LICENSE)).
The upstream project, its architecture, and all original credit belong to the
Race Condition team at Google — see [README.upstream.md](README.upstream.md) and
its Contributors section. This fork's changes are additive and keep the upstream
Vegas marathon demo render-identical.

- **Run the full stack (backend, agents, cloud):** follow
  [README.upstream.md](README.upstream.md).
- **Just see the offline scenarios:** open the
  [live demo](https://yorkerhodes3.github.io/race-condition-mod/) or run the
  frontend (`web/frontend`) with `npm ci && npm start`.
- **Understand the design:** [docs/DESIGN-CHANGES-SITE-Purpose.md](docs/DESIGN-CHANGES-SITE-Purpose.md),
  [docs/CONSOLE-REFERENCE.md](docs/CONSOLE-REFERENCE.md), and each pack's `README.md`.
