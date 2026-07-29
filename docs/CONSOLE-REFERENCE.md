# Console Reference — Menu + Hidden Features

A single place that surfaces **everything the app can do**, so no capability is
hidden behind a keystroke or insider knowledge. Two parts:

1. The **hamburger menu** (top-left) — what each item is.
2. **Everything else** — keystrokes, URL parameters, runtime config, scenario
   selectors, and debug tools that are *not* in the menu.

> Live site: https://yorkerhodes3.github.io/race-condition-mod/ · runs in
> **Cached mode** (recorded races replay client-side; no backend needed).

---

## 1. Hamburger menu — "Browse demos"

Top-left ☰ opens **Browse demos**. Source of truth:
[demo-config.ts](../web/frontend/src/app/demo-config.ts) (`DEMO_CONFIG`) and
[constants.ts](../web/frontend/src/constants.ts) (`DEMO_IDS`). Selecting an item
loads that demo's recorded run; the active demo's title shows next to the ☰
(hidden for demo 4). Each demo pairs a **recording** with an **agent persona**
and a replay **time scale**.

| # | Title | Agent | Exec summary |
|---|---|---|---|
| 00 | **Sandbox** | `planner_with_memory` | The resting/intro state. Renders the neon Strip with a sample A2UI "Vegas Strip Marathon Plan" dashboard (plan metadata + evaluation metrics + a *Run Simulation* button). What you see before choosing a demo. |
| 01 | **Build agents with Agent Platform** | `planner` | The baseline single agent: turns the prompt *"Plan a marathon in Las Vegas for 10,000 runners"* into a route + plan. Intro to building one agent. (2× replay) |
| 02 | **Creating multi-agent systems** | `planner_with_eval` | Adds an **evaluation** agent that scores the plan — a multi-agent pipeline. Carries the runner stream, so the field runs the route. (2×) |
| 03 | **Enhancing agents with memory** | `planner_with_memory` | Adds **memory/embeddings** so the planner recalls prior context across turns. Runner stream included. (6×) |
| 04 | **Debugging at scale** | `simulator_with_failure` | The **1,000-runner dense field** (`1k-runners.ndjson`) flowing along the route — the keynote visual. Focus: observability/debugging at scale. **This is the default demo on load.** (3×) |
| 05 (5a) | **Intent to infrastructure with Gemini Cloud Assist** | `simulator_with_failure` | Turns intent into infrastructure and walks a **failure** path (what breaks and how it surfaces). (3×) |
| 5b | **Intent to infrastructure … (Upgraded)** | `planner_with_memory` | The upgraded/successful variant: a richer results card (overall score, safety, runner experience, city disruption). (3×) |
| 07 (7a) | **Securing agents** | `planner_with_memory` | A **guardrail / prompt-injection** demo. The prompt tries to socially-engineer a budget increase (*"…glow sticks and those cool nighttime LED sunglasses?"*). Shows the *unprotected* behavior. (1.5×) |
| 7b | **Securing agents (Secure)** | `planner_with_memory` | Same prompt against the **secured** agent that resists the injection. Deliberately slowed (0.5×) so the guardrail is legible. |

---

## 2. Keyboard shortcuts (not shown anywhere)

All shortcuts require **Ctrl** and are ignored while typing in a text field.
Source: [demo.service.ts](../web/frontend/src/app/components/DemoOverlay/demo.service.ts),
[viewport-lookdev.component.ts](../web/frontend/src/app/viewport/viewport-lookdev.component.ts).

| Shortcut | Action |
|---|---|
| `Ctrl`+`0` | Load **Sandbox** |
| `Ctrl`+`1` / `2` / `3` / `4` | Load demo 1 / 2 / 3 / 4 |
| `Ctrl`+`5` / `Ctrl`+`Shift`+`5` | Load demo **5a** / **5b** |
| `Ctrl`+`7` / `Ctrl`+`Shift`+`7` | Load demo **7a** / **7b** |
| `Ctrl`+`R`, or `Ctrl`+(current demo's key) | **Reset** the current demo |
| `Ctrl`+`A` / `Ctrl`+`S` / `Ctrl`+`D` | Switch cinematic **Camera A / B / C** (Strip fly cameras) |
| `Ctrl`+`D` | Also **toggles "alternative panels"** (swaps the dashboard panel set) |
| `Ctrl`+`L` | Toggle **Cached ↔ Live** event replay (flashes a mode label) |
| `Ctrl`+`I` | Play the **camera intro** sequence |
| `Ctrl`+`Shift`+`I` | **Skip/complete** the camera intro immediately |

Other input: **Enter** sends a chat message, **Shift**+**Enter** inserts a
newline. In **debug mode** (below), clicking the ground paints a traffic-jam
zone (**Shift**+click toggles white/black).

---

## 3. URL query parameters (not shown anywhere)

Append to the URL, e.g. `…/?demo=2&debug=true`.

| Parameter | Values | Effect |
|---|---|---|
| `?demo=` | `Sandbox,1,2,3,4,5a,5b,7a,7b` | Auto-run a demo on load (overrides `AUTO_DEMO`). |
| `?debug=` | `true` | Enable **debug mode**: the HUD debug-race panel + the Tweakpane "Look dev" panel (see §5). |
| `?loading=` | `true` | Force the loading state (QA/screenshots). |
| `?scenario=` | site id (`vegas`) | Select the **Site Pack** — location, 3D model, map center. |
| `?theme=` | theme id (`vegas-neon`) | Select the **Theme Pack** — bloom + emissive tone. |
| `?route=` | route id (`vegas-marathon`) | Select the **Route Pack** — course distance + loop/corridor semantics. |
| `?groups=` | model id (`vegas-independent`) | Select the **Group cohesion** model. |
| `?mingle=` | model id (`vegas-none`) | Select the **Mingling / info** model. |
| `?movement=` | model id (`vegas-foot`) | Select the **Speed/Movement-mode** model. |

The scenario selectors (`scenario/theme/route/groups/mingle/movement`) all
default to Las Vegas today; they are the swap points for a second site (e.g.
Mariupol — see [P7-MARIUPOL-PREP.md](P7-MARIUPOL-PREP.md)). Sources:
[scenarios/](../web/frontend/src/app/scenarios/).

---

## 4. Runtime configuration — `window.ENV` (config.js)

Edit [public/config.js](../web/frontend/public/config.js) after deploy (no
rebuild). Locally, the Go BFF serves `/config.js` dynamically and overrides it.

| Key | Meaning |
|---|---|
| `AUTO_DEMO` | Demo id to auto-run on load. Default `'4'`. Empty string disables. Overridable per-visit via `?demo=`. |
| `NG_APP_GATEWAY_ADDR` | REST base for the gateway / DTSF twin control plane (spawn / sessions / reset / agent-types). Point at a running twin to drive live control. |
| `NG_APP_GATEWAY_URL` | WebSocket URL for the **live** event stream. Empty ⇒ stay in **Cached** mode (recorded replay). |

The scenario selectors in §3 can also be pinned here as `SCENARIO`, `THEME`,
`ROUTE`, `GROUPS`, `MINGLING`, `MOVEMENT` (query param wins over `window.ENV`).

---

## 5. Debug mode (`?debug=true`)

Two tools appear:

**HUD debug-race panel** (top-right, when a route is loaded and no sim is
running) — [hud.component.ts](../web/frontend/src/app/hud/hud.component.ts):
- **Runner count** (1–1000), **Speed** (0.5 / 1 / 2 / 3 / 5 / 10×), **Start** —
  runs a client-side debug race with no backend.

**Tweakpane "Look dev" panel** —
[viewport/debug/tweakpane.ts](../web/frontend/src/app/viewport/debug/tweakpane.ts).
Folders: **Performance** (incl. *Capture 15s* perf trace), **UI**, **Camera**,
**Post Processing → LUT**. Exposed debug actions include: route preview, start
runners, set race complete, clear routes, add info icons, toggle error, camera
intro, confetti, and camera presets (top / mid / close / A / B / top-route),
plus start-zone.

---

## 6. Modes: Cached vs Live

- **Cached (default):** recorded `.ndjson` runs replay client-side; no backend.
  Replay speed per demo is `recordingConfig.timeScale`; toggle replay with
  `Ctrl`+`L`.
- **Live:** set `NG_APP_GATEWAY_URL` (stream) and `NG_APP_GATEWAY_ADDR` (REST) in
  `config.js` to drive a DTSF twin control plane. See
  [pages.yml](../.github/workflows/pages.yml) "BACKEND WIRING".

---

## 7. Console surfacing checklist

To make these first-class in a Console UI, expose:
- [ ] Demo picker (already in ☰) — keep.
- [ ] **Camera switcher** (A/B/C) — currently only `Ctrl`+A/S/D.
- [ ] **Cached/Live toggle** — currently only `Ctrl`+L.
- [ ] **Reset** — currently only `Ctrl`+R.
- [ ] **Scenario selectors** (site/theme/route/groups/mingle/movement) — currently
      only URL params / `window.ENV`.
- [ ] **Debug tools** (runner count, speed, perf capture, camera presets) —
      currently only `?debug=true` + Tweakpane.
- [ ] **Replay speed** per run — currently only `recordingConfig.timeScale`.
