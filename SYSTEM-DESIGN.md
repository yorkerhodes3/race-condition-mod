# SYSTEM-DESIGN.md — Option B: Self-Hosted, Cloud-Free Race Condition

> Status: **design proposal**. This document describes a target architecture for
> running Race Condition without Google Cloud, using containers on localhost or
> self-hosted server hardware, with model inference routed through Ollama and/or
> an OpenAI-compatible proxy. It also describes hosting the frontend on GitHub
> Pages.
>
> Nothing in this document changes runtime behavior until the referenced files
> are actually added. Where a change to upstream code is required, it is called
> out explicitly as **[requires code change]**.

---

## 1. Goals and constraints

| Goal | Requirement |
|---|---|
| No cloud hardware cost | No Vertex AI, Cloud Run, Agent Engine, AlloyDB, or Memorystore |
| Portable | One `docker compose up` on a laptop or a self-hosted server |
| Reachable | Sits behind an API gateway / existing reverse proxy (TLS terminated upstream) |
| Model-flexible | Pick the model at runtime and route it through Ollama or an existing OpenAI-compatible proxy, so we can A/B different models |
| Cheap demo surface | Publish the frontend as a static site on GitHub Pages for a zero-backend "touch and feel" |

Non-goals: production autoscaling, GPU orchestration (GKE), managed persistence.

---

## 2. What the upstream architecture actually requires

Findings from the current code that drive this design:

1. **Cached mode is 100% client-side.** The Angular app fetches NDJSON recordings
   from `/assets/*.ndjson` (see [web/frontend/src/app/demo-config.ts](web/frontend/src/app/demo-config.ts))
   and imports `cached_routes/*.json` at build time. In cached mode **no gateway,
   no agents, and no LLM are contacted**. This is what makes GitHub Pages viable.

2. **The runner is already model-agnostic.** [agents/runner/agent.py](agents/runner/agent.py)
   selects its backend from `RUNNER_MODEL`:
   - `gemini-*` → Vertex AI (cloud)
   - `ollama_chat/<model>` → local Ollama via LiteLLM
   - `openai/<model>` + `VLLM_API_URL`/`OPENAI_API_BASE` → any OpenAI-compatible
     server (vLLM, LiteLLM proxy, LM Studio, our existing proxy).

3. **The simulator does not call an LLM at runtime.** [agents/simulator/agent.py](agents/simulator/agent.py)
   declares Gemini models on its `LlmAgent`s, but every one uses a
   `before_model_callback` (see [agents/simulator/tick_callback.py](agents/simulator/tick_callback.py)
   and [agents/simulator/pre_race_callback.py](agents/simulator/pre_race_callback.py))
   that returns a deterministic `LlmResponse` and **prevents the model call**. So
   the simulator runs cloud-free as-is; the declared model is never invoked.

4. **The planner is the only hard cloud dependency for live runs.**
   [agents/planner/agent.py](agents/planner/agent.py) hardcodes
   `resilient_model("gemini-3-flash-preview")`, and
   [agents/planner/skills/gis-spatial-engineering/scripts/tools.py](agents/planner/skills/gis-spatial-engineering/scripts/tools.py)
   makes a direct Vertex `generate_content` call. To go fully cloud-free in *live*
   mode, the planner must either be skipped (use cached routes) or patched to honor
   an OpenAI-compatible endpoint. **[requires code change]**

5. **The gateway is the only public entry point.** The Go gateway
   ([cmd/gateway](cmd/gateway)) terminates the browser WebSocket (`/ws`) and fans
   requests out to agents over A2A. Everything else (planner, simulator, runner,
   redis, pubsub) is internal.

### Consequence: three deployment "faces"

| Face | Backend needed | LLM cost | Use |
|---|---|---|---|
| **Static demo (GitHub Pages)** | none | none | Public "touch and feel", cached replays only |
| **Self-hosted deterministic** | gateway + simulator + `runner_autopilot` + redis + pubsub | none | Full live simulation loop, deterministic runners, no LLM at all |
| **Self-hosted LLM** | above + `runner` (Ollama/proxy) [+ planner patch] | local/proxy only | Live LLM-driven runners; model chosen at runtime |
| **DTSF Twin (recommended first backend)** | DTSF server only (already available locally) | none | Deterministic clone of the gateway REST control plane; frontend streams via Cached mode. See §2A. |

---

## 2A. Recommended delivery: Race Condition backend as a DTSF Twin

The **Digital Twin Systems Framework** (DTSF, at `C:\Dev\Digital Twin Systems
Framework`) is a TypeScript/Node runtime that hosts "twins" — behavioral clones
of external HTTP services, each defined by an OpenAPI contract + a
`BaseBehaviorPack` + seeded, snapshot-able state + fault profiles. It is already
runnable locally via **"Start DTSF server"** (`npm start`, serving
`http://localhost:8080`, discovering packs under `twins/packs/*/twin.yaml`).

Because DTSF is already available and Docker-based, the fastest way to "touch
and feel" the Race Condition backend is to **run it as a DTSF twin** rather than
standing up the full Go/Python/Redis/Pub-Sub stack.

### Why it fits

- **The gateway's public surface is a REST control plane** — `/api/v1/agent-types`,
  `/sessions`, `/spawn`, `/simulations`, `/environment/reset`, `/health`,
  `/config` (see [cmd/gateway/main.go](cmd/gateway/main.go) and
  [docs/api/REFERENCE.md](docs/api/REFERENCE.md)). That maps 1:1 onto a DTSF
  OpenAPI contract + behavior pack.
- **DTSF already solves model selection.** It ships an `ollama` twin
  (OpenAI-compatible `/v1/*`, runtime model switching, live/recorded/mock). RC's
  runner is OpenAI-compatible-configurable, so any real runner points
  `OPENAI_API_BASE` at the DTSF ollama twin — exactly the "select models via our
  proxy" requirement, with A/B switching and zero cloud.
- **DTSF's Replay/Simulation + snapshot engine** aligns with RC's recorded NDJSON
  runs, giving a future path for streaming (below).

### The one gap: the `/ws` event stream

DTSF twins are **HTTP request/response** clones (Express runtime; a pack returns
one response per request). The gateway's realtime `/ws` WebSocket broadcast does
not fit that contract. Resolution:

1. **Now:** the Angular frontend already replays the event stream **client-side**
   in Cached mode (`web/frontend/public/assets/*.ndjson`). The twin serves the
   REST control plane; the frontend serves the stream. Together = full local
   touch-and-feel, no live agents.
2. **Later:** expose RC's NDJSON via DTSF's **Replay** methodology over SSE
   (recordings = trajectory source, DTSF snapshots = restore points). See the
   framework's `SIMULATION-SPEC.md`.

### Deliverable in this repo

A ready-to-activate twin pack lives at
[dtsf/packs/race-condition/](dtsf/packs/race-condition/README.md):

```
dtsf/packs/race-condition/
├── twin.yaml                 # dtsf/v0.1 TwinManifest (seed=42)
├── contracts/openapi.yaml    # gateway REST control plane (OpenAPI 3.0.3)
├── behavior/pack.ts          # BaseBehaviorPack: deterministic spawn/session/sim/reset state
├── faults/{latency,throttle}.yaml
└── README.md                 # activation + frontend + ollama-twin wiring
```

Activate it (junction keeps a single source of truth), then start the server:

```powershell
New-Item -ItemType Junction `
  -Path "C:\Dev\Digital Twin Systems Framework\twins\packs\race-condition" `
  -Target "C:\Dev\race-condition-mod\dtsf\packs\race-condition"
# then: Start DTSF server  → http://localhost:8080/race-condition/
```

Session IDs are seed-derived (`sess-<seed>-<n>`) for reproducibility and clean
interaction with DTSF snapshots. Full activation, verification `curl`s, frontend
env, and ollama-twin model wiring are in the pack README.

> This twin covers the **control plane**. The containerized topology in §3–§4
> remains the path when you need the *real* simulator/runner compute (live ticks,
> LLM decisions) rather than a deterministic clone.

---

## 3. Target topology (self-hosted, containerized)

```mermaid
flowchart LR
    subgraph edge["Edge (existing proxy / API gateway, TLS)"]
        proxy[Reverse proxy\nwss:// + https://]
    end

    subgraph host["Self-hosted Docker host"]
        fe[frontend BFF\n:9118 → serves Angular dist]
        gw[gateway\n:9101 /ws + A2A]
        sim[simulator\n:9104]
        pl[planner\n:9105]
        run[runner\n:9108]
        auto[runner_autopilot\n:9110]
        dash[agent-dash\n:9111]
        redis[(redis)]
        pubsub[(pubsub emulator)]
        pg[(postgres+pgvector\noptional)]
    end

    subgraph models["Model plane (no cloud)"]
        ollama[Ollama\n:11434]
        llmproxy[OpenAI-compatible proxy\n(existing)]
    end

    browser[Browser] -->|https / wss| proxy
    proxy --> fe
    proxy --> gw
    fe -. optional dev proxy .-> gw
    gw <-->|A2A http| sim
    gw <-->|A2A http| pl
    sim <-->|A2A http| run
    sim <-->|A2A http| auto
    gw --- redis
    sim --- redis
    gw --- pubsub
    sim --- pubsub
    pl -. optional .- pg
    run -->|OPENAI_API_BASE| llmproxy
    run -->|ollama_chat/*| ollama
    llmproxy --> ollama
```

Notes:
- **TLS is terminated at the existing proxy.** Containers speak plain HTTP/WS on
  the internal network. Only the proxy is exposed.
- **Two public routes only:** `https://<host>/` → frontend BFF, and
  `wss://<host>/ws` → gateway. Everything else stays on the private compose network.
- **The model plane is swappable.** Point `runner` at Ollama directly, or at the
  existing OpenAI-compatible proxy which itself may front Ollama, vLLM, or hosted
  models. This is the A/B switch.

---

## 4. Container plan

### 4.1 Images to build

The existing [Dockerfile](Dockerfile) already targets: `gateway`, `admin`,
`tester`, `frontend` (Go) and `runner_autopilot`, `runner_cloudrun`, `dash`
(Python). To run a full live simulation in containers we must **add targets for
the agents that currently only run via the local Procfile**:

| New target | Mirrors | Entry point |
|---|---|---|
| `simulator` | `runner_cloudrun` pattern | `agents/simulator/agent.py` |
| `planner` | `runner_cloudrun` pattern | `agents/planner/agent.py` |
| `runner` | `runner_cloudrun` (already close) | `agents/runner/agent.py` |

Each is a thin stage on top of `python-deps` that copies `agents/<name>/`,
`agents/utils/`, and `gen_proto/`, sets `PYTHONPATH=.`, and runs the agent with
`DISPATCH_MODE` matching the Procfile (`callable` for planner/simulator,
`subscriber` for runners).

The `frontend` target expects `web/frontend/dist/` to be **pre-built**. Add a
web build stage (or extend the existing `web-builder`) that runs
`cd web/frontend && npm ci && npm run build` so the compose build is self-contained.

### 4.2 New compose file: `docker-compose.app.yml`

A new overlay that layers the application services on top of the existing
infra-only [docker-compose.yml](docker-compose.yml) (redis, pubsub, postgres).
Run both together:

```bash
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d --build
```

Sketch of the service definitions (illustrative — env keys come from
[.env.example](.env.example)):

```yaml
# docker-compose.app.yml (overlay)
services:
  gateway:
    build: { context: ., dockerfile: Dockerfile, target: gateway }
    environment:
      PORT: 9101
      REDIS_ADDR: redis:6379
      PUBSUB_EMULATOR_HOST: pubsub:8085
      AGENT_URLS: http://simulator:9104,http://planner:9105,http://runner:9108,http://runner-autopilot:9110
    depends_on: [redis, pubsub, simulator, planner]

  simulator:
    build: { context: ., dockerfile: Dockerfile, target: simulator }
    environment:
      PORT: 9104
      DISPATCH_MODE: callable
      REDIS_ADDR: redis:6379
      PUBSUB_EMULATOR_HOST: pubsub:8085
      MAX_RUNNERS_AUTOPILOT: 200
      MAX_RUNNERS_LLM: 20

  runner:
    build: { context: ., dockerfile: Dockerfile, target: runner }
    environment:
      PORT: 9108
      DISPATCH_MODE: subscriber
      REDIS_ADDR: redis:6379
      PUBSUB_EMULATOR_HOST: pubsub:8085
      # ---- Model selection (the A/B switch) ----
      RUNNER_MODEL: ${RUNNER_MODEL:-ollama_chat/gemma4:e2b}
      OPENAI_API_BASE: ${OPENAI_API_BASE:-}   # set to proxy /v1 for OpenAI-compatible routing
      OPENAI_API_KEY: ${OPENAI_API_KEY:-not-needed}
      OLLAMA_API_BASE: ${OLLAMA_API_BASE:-http://ollama:11434}

  runner-autopilot:
    build: { context: ., dockerfile: Dockerfile, target: runner_autopilot }
    environment:
      PORT: 9110
      DISPATCH_MODE: subscriber
      REDIS_ADDR: redis:6379
      PUBSUB_EMULATOR_HOST: pubsub:8085

  planner:
    build: { context: ., dockerfile: Dockerfile, target: planner }
    environment:
      PORT: 9105
      DISPATCH_MODE: callable
      # See §6 for cloud-free planner options.

  frontend:
    build: { context: ., dockerfile: Dockerfile, target: frontend }
    environment:
      PORT: 9118
      GATEWAY_INTERNAL_URL: http://gateway:9101
    depends_on: [gateway]

  # Optional: bundle Ollama so the stack is self-contained
  ollama:
    image: ollama/ollama:latest
    volumes: [ollama-models:/root/.ollama]
    # GPU passthrough optional; CPU works for small Gemma models

volumes:
  ollama-models:
```

> The container-to-container addresses (`redis:6379`, `pubsub:8085`,
> `http://simulator:9104`) differ from the local `127.0.0.1:91xx` values in
> `.env`. Keep a dedicated `.env.docker` for the compose stack so the two do not
> collide.

### 4.3 Ollama placement

Two supported layouts:

1. **Sidecar Ollama** (shown above) — fully self-contained, `OLLAMA_API_BASE=http://ollama:11434`.
2. **External proxy** — leave `RUNNER_MODEL=openai/<model>` and
   `OPENAI_API_BASE=https://<our-proxy>/v1`; the proxy owns model selection and
   can front Ollama/vLLM/hosted backends. This is the recommended path when "our
   existing proxy" already exists, because model A/B testing then happens in the
   proxy config, not in the app.

---

## 5. Model selection & the proxy (the A/B switch)

The runner resolves its backend at process start:

| Intent | Env |
|---|---|
| Local Ollama, model X | `RUNNER_MODEL=ollama_chat/<X>`, `OLLAMA_API_BASE=http://ollama:11434` |
| Existing OpenAI-compatible proxy | `RUNNER_MODEL=openai/<X>`, `OPENAI_API_BASE=https://<proxy>/v1`, `OPENAI_API_KEY=<key or not-needed>` |
| vLLM server | `RUNNER_MODEL=openai/<X>`, `VLLM_API_URL=http://vllm:8000/v1` |

Because selection is env-driven, A/B testing a model is a container restart with
a different `RUNNER_MODEL`/`OPENAI_API_BASE`, or a routing rule in the proxy. No
code change. To compare two models simultaneously, run two `runner` services with
different `AGENT_NAME` (e.g. `runner_a`, `runner_b`) and add both to the
simulator's runner pool.

**Recommendation:** route through the existing OpenAI-compatible proxy. It keeps
model choice, keys, rate limits, and observability in one place and matches the
"behind our existing proxy" requirement. Ollama becomes just one backend the
proxy can target.

---

## 6. Making the planner cloud-free  [requires code change]

The planner is the one component that still calls Gemini directly. Options, in
increasing order of effort:

1. **Skip live planning (recommended first step).** Use the frontend's cached
   routes (`cached_routes/*.json` + the Organizer cached surface). The live
   simulation loop + runners still run for real; only route *generation* is
   pre-baked. Zero code change.
2. **Env-gate the planner model.** Introduce `PLANNER_MODEL` handling that mirrors
   the runner: `gemini-*` → Vertex, otherwise `LiteLlm(model=PLANNER_MODEL)` with
   `OPENAI_API_BASE`. Also gate the direct Vertex call in the GIS traffic tool
   behind a feature flag so it degrades gracefully when unset (the code already
   tolerates Maps tools being disabled). Small, localized change.
3. **Full parity.** Give planner, `planner_with_eval`, and `planner_with_memory`
   the same model-abstraction and point them at the proxy. Larger; only needed if
   live route planning quality matters for the experiments.

Until (2)/(3) land, the honest statement is: **fully cloud-free = cached routes
+ deterministic simulator + Ollama/proxy runners.**

---

## 7. Frontend on GitHub Pages

### 7.0 Frontend delivery when `npm install` is blocked

This machine's `npm` points at an internal feed missing some public versions,
and `node_modules` hits `EPERM` locks — so the Angular build may be permanently
blocked here. Options for a UI, ranked:

1. **DTSF-hosted console (implemented, zero deps).** `dtsf/packs/race-condition/race-condition-app.html`
   is a self-contained vanilla-JS/canvas UI that DTSF serves at
   `http://localhost:8080/_app/race-condition`. It drives the twin (spawn/flush/
   reset) and animates `GET /api/v1/replay`. **No npm, no build.** This is the
   recommended "touch and feel" while npm is blocked.
2. **Fix the registry, keep npm.** Add a project `.npmrc` with
   `registry=https://registry.npmjs.org` (policy permitting), delete the locked
   `node_modules` after closing the editor/AV holding it, then `npm ci`. Lowest
   effort *if* the public registry is allowed.
3. **Alternate package manager.** `pnpm` (content-addressed store, fewer file
   locks) or `bun install` (single binary, fast) — both still need a reachable
   registry, so pair with option 2's `.npmrc`.
4. **Build elsewhere, serve the artifact.** Build `web/frontend/dist` on a
   machine/CI that has registry access, commit or copy the `dist/`, then serve
   it statically (the Go `frontend` BFF, `npx http-server`, or GitHub Pages).
   Decouples build from this host entirely.
5. **Vendor `node_modules`.** Copy a known-good `node_modules` from another
   machine with the same Node 24 + lockfile. Heavy and brittle; last resort.

Options 3–5 all require a Docker or Node toolchain step that isn't currently
available here, so **option 1 is the practical path today**; option 4 (build in
CI) is the best path to the real Angular UI without touching this machine's npm.

### 7.1 Why GitHub Pages works
The Angular app builds to a static bundle (`ng build`, output `dist/`), and cached
mode needs only static assets. So a static host can serve the full "touch and
feel" (all nine demos, cached replays) with no backend.

### 7.2 What to configure

1. **Base href.** GitHub *project* pages serve under a subpath
   (`https://<user>.github.io/<repo>/`). Build with
   `ng build --base-href /<repo>/`. A *user/org* page or a custom domain serves at
   root and avoids the subpath entirely.

2. **Absolute asset paths — the main gotcha.** [demo-config.ts](web/frontend/src/app/demo-config.ts)
   fetches recordings with absolute paths like `/assets/sim-1-log.ndjson`. Under a
   project-page subpath these resolve to `/<wrong>/assets/...` and 404. **Pick one:**
   - deploy at **root** (user/org page or custom domain) — absolute paths just work; **[no code change]**, simplest; **recommended**, or
   - make the fetch paths base-href-relative (read `document.baseURI` / Angular
     `APP_BASE_HREF` and prefix the asset URLs). **[requires small code change]**

3. **SPA fallback + Jekyll.** Add a `404.html` that is a copy of `index.html` (so
   deep links work), and an empty `.nojekyll` file (so GitHub Pages serves any
   `_`-prefixed files and skips Jekyll processing).

4. **Build-time env.** The app uses `@ngx-env/builder`, so `NG_APP_*`/`VITE_*`
   values are baked at build time. For a **cached-only** Pages deploy, point the
   gateway URL at a placeholder or the self-hosted `wss://` endpoint; cached mode
   never dials it. For a Pages frontend that also offers **Live** mode, set
   `NG_APP_GATEWAY_URL=wss://<self-hosted-host>/ws` at build time and ensure the
   gateway's `CORS_ALLOWED_ORIGINS` includes the Pages origin.

### 7.3 Deploy workflow (sketch)

`.github/workflows/pages.yml`:

```yaml
name: Deploy frontend to GitHub Pages
on:
  push: { branches: [main] }
permissions: { pages: write, id-token: write, contents: read }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - working-directory: web/frontend
        run: |
          npm ci
          npm run build -- --base-href "/${GITHUB_REPOSITORY#*/}/"
          cp dist/browser/index.html dist/browser/404.html
          touch dist/browser/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with: { path: web/frontend/dist/browser }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/deploy-pages@v4
```

`.github/workflows/pages.yml`:

```yaml
name: Deploy frontend to GitHub Pages
on:
  push: { branches: [main] }
permissions: { pages: write, id-token: write, contents: read }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - working-directory: web/frontend
        run: |
          npm ci
          npm run build -- --base-href "/${GITHUB_REPOSITORY#*/}/"
          cp dist/browser/index.html dist/browser/404.html
          touch dist/browser/.nojekyll
      - uses: actions/upload-pages-artifact@v3
        with: { path: web/frontend/dist/browser }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages }
    steps:
      - uses: actions/deploy-pages@v4
```

> **Implemented** as [.github/workflows/pages.yml](.github/workflows/pages.yml)
> with output-dir auto-detection, SPA `404.html`, `.nojekyll`, and a
> `base_href` input. Because the build runs on GitHub's runners (public
> registry), the local npm block does not affect the Pages deployment.

### 7.4 Backing the Pages frontend with the DTSF twin

The frontend resolves its backend at **runtime** from `window.ENV` in
`assets/config.js` (see
[agent-gateway-updates.ts](web/frontend/src/app/agent-gateway-updates.ts#L122)),
falling back to build-time env. So **one Pages artifact is repointable** without
a rebuild — publish a `config.js`:

```js
window.ENV = {
  NG_APP_GATEWAY_ADDR: "http://localhost:8080/race-condition", // local docker DTSF now
  // NG_APP_GATEWAY_ADDR: "https://<host>/race-condition",      // server-hosted DTSF later
  NG_APP_GATEWAY_URL:  ""   // twin serves no live /ws; keep Cached mode for the stream
};
```

Reachability rules:
- **Local docker DTSF:** an HTTPS Pages page may call `http://localhost:8080`
  because browsers treat `localhost` as a secure context — so the same user's
  machine reaches the local twin with no proxy.
- **Server-hosted DTSF:** must be HTTPS behind your proxy
  (`https://<host>/race-condition`) or the browser blocks it as mixed content.
- **CORS:** the twin returns permissive CORS headers and handles `OPTIONS`
  preflight (see the pack's `json()` + OPTIONS branch), so cross-origin calls
  from the Pages origin succeed.

What each mode gives you:

| Mode | Visual stream | Backend | On Pages |
|---|---|---|---|
| **Cached** (default) | recorded NDJSON, client-side | none | identical to upstream experience, zero setup |
| **Twin REST** | Cached visuals + live control-plane calls (spawn/reset/agent-types) to the twin | DTSF twin | set `NG_APP_GATEWAY_ADDR` in config.js |
| **Twin replay** | animate `GET /api/v1/replay` (needs a frontend data-source adapter — follow-up) | DTSF twin | requires the adapter in §7.6 |
| **Live** | real WebSocket `/ws` | real gateway (not the twin) | needs the full stack, not the twin |

### 7.5 Live mode from a public static frontend
Cached mode is safe to publish. **Live** mode from a public Pages site points the
browser at your self-hosted `wss://<host>/ws`, which means the gateway is
internet-exposed through the proxy. Gate this: require the proxy to enforce
auth/allow-listing, keep `CORS_ALLOWED_ORIGINS` tight (the Pages origin only), and
prefer keeping Live mode for the self-hosted-served frontend rather than the
public Pages one.

### 7.6 Follow-up: a twin-driven replay data source (real "leverages DTSF" visuals)
To make the 3D visuals themselves twin-driven (not just cached), add a data
source in the frontend that fetches `GET /api/v1/replay` and feeds the existing
render pipeline. The honest cost: the current Cached path replays the frontend's
**NDJSON wire format** (base64 protobuf `Wrapper` records), while the twin's
replay returns plain JSON frames. So the adapter must either (a) translate
replay frames into the internal runner-position updates the renderer consumes,
or (b) have the twin emit the NDJSON wire format. (a) is the smaller change and
is the recommended path; it is a frontend-code task that needs a build to
validate.

---

## 8. Security & operations

- **TLS at the proxy only.** Containers speak HTTP/WS internally; never expose
  agent/redis/pubsub ports publicly. In compose, only publish the proxy (or the
  frontend BFF + gateway if the proxy is external).
- **No secrets in the image.** Model keys (`OPENAI_API_KEY`) come from
  `.env.docker` / proxy config, not baked into layers. `.env*` stays gitignored.
- **CORS.** `CORS_ALLOWED_ORIGINS` defaults to `*` in [.env.example](.env.example);
  tighten to the real frontend origin(s) for any internet-facing deploy.
- **Resource caps.** Small Gemma models on CPU are slow; cap concurrent LLM
  runners (`MAX_RUNNERS_LLM`) low and lean on `runner_autopilot` for scale tests
  (deterministic, zero inference).
- **Persistence.** Redis is ephemeral session/pubsub fanout; fine to lose on
  restart. Postgres/pgvector is only needed for `planner_with_memory`; omit it
  unless memory experiments are in scope.

---

## 9. Phased rollout

1. **Phase 0 — Static demo.** Ship the Angular app to GitHub Pages (cached mode).
   Zero backend, zero cost, immediate "touch and feel". (§7)
2. **Phase 1 — Deterministic self-host.** `docker-compose.app.yml` with gateway +
   simulator + `runner_autopilot` + redis + pubsub + frontend BFF, behind the
   proxy. Live simulation loop, no LLM. (§4)
3. **Phase 2 — LLM runners via Ollama/proxy.** Add the `runner` container; select
   models via `RUNNER_MODEL`/`OPENAI_API_BASE`. A/B models through the proxy. (§5)
4. **Phase 3 — Cloud-free planner.** Land the `PLANNER_MODEL` abstraction so live
   route planning also runs on Ollama/proxy. (§6)

---

## 10. Concrete artifact checklist

To implement this design, the following files would be added/changed:

- [x] `dtsf/packs/race-condition/` — DTSF twin of the gateway control plane
      (§2A). **Done** — activate via junction/copy into the DTSF repo.
- [x] `dtsf/packs/race-condition/race-condition-app.html` — npm-free console UI
      served by DTSF at `/_app/race-condition` (§7.0). **Done.**
- [x] `dtsf/packs/race-condition` `GET /api/v1/replay` — twin-driven trajectory
      for client-side replay. **Done.**
- [ ] `Dockerfile` — add `simulator`, `planner`, `runner` targets; add a
      `web/frontend` build stage.
- [ ] `docker-compose.app.yml` — application overlay (§4.2).
- [ ] `.env.docker` — container-network addresses + model/proxy env.
- [x] `.github/workflows/pages.yml` — CI-built static frontend deploy (§7.3).
      **Done.**
- [x] `dtsf/packs/race-condition` CORS + `OPTIONS` preflight — lets a Pages
      frontend call the twin cross-origin (§7.4). **Done.**
- [ ] `web/frontend` — `404.html`/`.nojekyll` handling; optional base-href-relative
      asset paths (§7.2). **[code change]**
- [ ] `agents/planner` — optional `PLANNER_MODEL` abstraction (§6). **[code change]**
```
