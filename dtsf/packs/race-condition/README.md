# Race Condition — DTSF Twin

A **Digital Twin Systems Framework (DTSF)** twin that clones the **Race
Condition gateway's REST control plane**. It lets you run the Race Condition
backend locally on the DTSF server ("Start DTSF server") with **no Go, Python,
Redis, Pub/Sub, or GCP** — the twin reproduces the gateway API deterministically
from in-memory, seeded state.

This pack is authored here in the `race-condition-mod` fork so it is
version-controlled with the rest of the backend work. It is **activated** by
making it discoverable to a running DTSF instance (see below).

## What the twin reproduces

Mirrors `docs/api/REFERENCE.md` / `cmd/gateway/main.go`:

| Method | Path | Behavior |
|---|---|---|
| GET | `/health` | `{status:ok, service:gateway, twin}` |
| GET | `/config` | `{max_runners}` |
| GET | `/api/v1/agent-types` | Seeded agent cards (planner, simulator, runner, runner_autopilot) |
| GET | `/api/v1/sessions` | Active session IDs |
| POST | `/api/v1/sessions` | Create one session → `201 {status:pending, sessionId, message}` |
| POST | `/api/v1/sessions/flush` | `{status:flushed, count}` |
| POST | `/api/v1/spawn` | Batch spawn N sessions; registers `simulation_id` |
| GET | `/api/v1/simulations` | Active simulation IDs |
| POST | `/api/v1/environment/reset` | Selective reset (`sessions|queues|maps|pubsub`) |
| GET | `/api/v1/replay` | Deterministic race trajectory for client-side replay (query: `runners`, `ticks`, `simulation_id`) |

Session IDs are deterministic (`sess-<seed>-<n>`) so runs are reproducible and
work cleanly with DTSF snapshots and the Replay simulation methodology.

## What it does NOT reproduce — and why

The realtime **`/ws` WebSocket event stream** is out of scope. DTSF twins are
HTTP request/response clones (Express-based runtime, `handleRequest` returns a
single response), so a WebSocket broadcast channel does not fit the twin
contract. This is handled two ways:

- **Twin-driven replay (implemented).** `GET /api/v1/replay` returns a full,
  deterministic trajectory in one response; the client replays it with timing.
  The bundled console UI animates it. Same replay pattern as the frontend's
  Cached mode, but the frames come from the twin (so they reflect twin state +
  seed).
- **Angular Cached mode.** The real frontend also replays NDJSON client-side
  from `web/frontend/public/assets/*.ndjson`, no backend needed.

> True *progressive* SSE (frames pushed over time) cannot come from a pack — the
> contract returns a single body. If live push is needed, add it at the DTSF
> runtime level or a small sidecar; the single-response replay covers the
> touch-and-feel case without either.

## Touch and feel with NO npm — the bundled console UI

The pack ships `race-condition-app.html`, a self-contained control console
(vanilla HTML/JS/canvas, zero dependencies). DTSF serves any `<twin>-app.html`
automatically, so once the twin is loaded it is live at:

**http://localhost:8080/_app/race-condition**

Spawn/flush/reset buttons, live session/simulation counts, and a canvas that
animates `/api/v1/replay` — a working "touch and feel" without building the
Angular frontend (no `npm install` required).

## Activate on your local DTSF server

The DTSF runtime discovers packs under `<DTSF>/twins/packs/*/twin.yaml`
(overridable via `DTSF_TWIN_PACKS_DIR`). Make this pack visible one of two ways:

**Option 1 — directory junction (single source of truth, recommended):**

```powershell
# Directory junctions do NOT require admin/elevation on Windows.
# Set these to your local checkouts:
$DTSF_HOME = "<path-to-your-DTSF-checkout>"
$RC_REPO   = "<path-to-this-repo>"
New-Item -ItemType Junction `
  -Path "$DTSF_HOME\twins\packs\race-condition" `
  -Target "$RC_REPO\dtsf\packs\race-condition"
```

**Option 2 — copy:**

```powershell
Copy-Item -Recurse `
  "$RC_REPO\dtsf\packs\race-condition" `
  "$DTSF_HOME\twins\packs\race-condition"
```

Then start the server (the command you already use):

```
Start DTSF server        # i.e. npm start in the DTSF repo
```

The twin mounts at **http://localhost:8080/race-condition/**. Verify:

```powershell
curl http://localhost:8080/race-condition/health
curl -X POST http://localhost:8080/race-condition/api/v1/spawn `
  -H "content-type: application/json" `
  -d '{"agents":[{"agentType":"runner_autopilot","count":50}],"simulation_id":"demo"}'
curl http://localhost:8080/race-condition/api/v1/simulations
```

## Point the Race Condition frontend at the twin

**Recommended (no npm):** use the bundled console at
`http://localhost:8080/_app/race-condition` — it already drives the twin.

For the full Angular 3D frontend (requires a working `npm install`; see the
fork's `SYSTEM-DESIGN.md` §Frontend for npm-free alternatives), set the gateway
address to the twin base path before building/serving:

```
NG_APP_GATEWAY_ADDR=http://localhost:8080/race-condition
# Leave the frontend in Cached mode for the event stream (default on load).
```

Live `/ws` mode will not connect against the twin by design — keep Cached mode
for streaming, or run the real gateway when you need live WebSocket traffic.

## Model selection via Ollama (reuse the DTSF `ollama` twin)

DTSF already ships an **`ollama` twin** (OpenAI-compatible `/v1/*`, runtime
model switching, live/recorded/mock modes). Race Condition's runner is already
OpenAI-compatible-configurable, so when you run a *real* runner alongside the
twinned control plane, route its model calls through the DTSF Ollama twin:

```
RUNNER_MODEL=openai/llama3.2          # or any model the ollama twin serves
OPENAI_API_BASE=http://localhost:8080/ollama/v1
OPENAI_API_KEY=not-needed
```

A/B different models by switching the model in the ollama twin's dashboard or
by changing `RUNNER_MODEL` — no cloud, no code changes.

## Notes

- The behavior pack imports `@dtsf/types` and `@dtsf/twin-sdk`; those resolve
  only inside the DTSF workspace, so type errors shown in this fork are
  expected. The pack builds and runs once it lives under the DTSF repo.
- Fault profiles (`faults/latency.yaml`, `faults/throttle.yaml`) are loaded but
  toggled from the twin's Console/dashboard, matching DTSF conventions.
