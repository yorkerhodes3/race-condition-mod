# Deployment Harnesses — GCP / Azure / GPU‑Server

This document inventories every external dependency Race Condition uses, maps
each to a **provider‑agnostic capability**, and defines **swappable harnesses**
so the same application can be deployed against:

- **GCP** — the existing/native target (Vertex AI, Memorystore, AlloyDB, Pub/Sub).
- **Azure** — Azure OpenAI, Azure Cache for Redis, Azure Database for PostgreSQL,
  Service Bus / Key Vault.
- **GPU‑Server** — a self‑hosted box: vLLM/Ollama for models, local Postgres +
  pgvector, local Redis, containerized Pub/Sub emulator. No cloud.

The design principle: **the app is entirely environment‑driven**, and the model
layer already uses [LiteLLM](https://docs.litellm.ai) (native `gemini` / `azure`
/ `openai` / `ollama` providers). So most capabilities swap via an **env profile**
([deploy/harness/profiles/](../deploy/harness/profiles/)); only a few need a thin
code adapter, which this doc calls out explicitly.

---

## 1. Dependency inventory

Grounded in the source and the API‑enable list
([infra/modules/project-apis/variables.tf](../infra/modules/project-apis/variables.tf)).

| # | Capability | What uses it | GCP (native) API |
|---|---|---|---|
| C1 | **LLM inference** | all agents (planner, simulator callbacks, runner) | Vertex AI `aiplatform.googleapis.com` (Gemini) |
| C2 | **Text embeddings** | `planner_with_memory` route/regulation vectors | Vertex AI `gemini-embedding-001` |
| C3 | **LLM‑as‑judge eval** | `planner_with_eval` | Vertex AI **Eval API** |
| C4 | **Agent long‑term memory** | `planner_with_memory` | Vertex AI **Memory Bank** |
| C5 | **Vector store / relational** | route memory, regulations (pgvector) | AlloyDB `alloydb.googleapis.com` |
| C6 | **Session / state cache** | gateway sessions, ECS fan‑out | Memorystore Redis `redis.googleapis.com` |
| C7 | **Pub/Sub telemetry bus** | simulator → dashboard/runners | Pub/Sub `pubsub.googleapis.com` |
| C8 | **Secrets** | Maps key, DB password | Secret Manager `secretmanager.googleapis.com` |
| C9 | **Maps grounding** (optional) | planner `search_places`/`compute_routes`/`lookup_weather` | Maps MCP `mapstools`/`places`/`weather`/`agentregistry` |
| C10 | **Object storage / artifacts** | agent artifacts (cloud only) | GCS |
| C11 | **Compute / hosting** | gateway, BFFs, agents | Cloud Run + Vertex AI Agent Engine |
| C12 | **Content safety** (optional) | "securing agents" demo | Model Armor `modelarmor.googleapis.com` |

> The **frontend** (GitHub Pages / cached mode) uses **none** of these at
> runtime — the 3D city is a baked GLB and demos are recorded NDJSON. Only Google
> Fonts is fetched. Harnesses below concern the **backend** (live agents).

---

## 2. Capability → provider matrix

Legend: **env** = swaps by configuration only · **adapter** = needs a small code
shim · **degrade** = feature auto‑falls back when the provider is absent.

| Cap | GCP (existing) | Azure | GPU‑Server (self‑hosted) | Swap type |
|---|---|---|---|---|
| C1 LLM | `RUNNER_MODEL=gemini-*` (Vertex) | `RUNNER_MODEL=azure/<deployment>` (LiteLLM Azure OpenAI) | `RUNNER_MODEL=openai/<model>` → vLLM, or `ollama_chat/<model>` | **env** |
| C2 Embeddings | `EMBEDDING_BACKEND=vertex_ai` | Azure OpenAI `text-embedding-3-*` | local (bge/e5 via vLLM or sentence-transformers) | **adapter** (add `azure`/`local` backend) |
| C3 Eval | Vertex Eval API | heuristic scorer (built‑in fallback) | heuristic scorer | **degrade** |
| C4 Memory Bank | Vertex Memory Bank | AlloyDB/Postgres store (existing alt path) | local Postgres store | **degrade / env** |
| C5 pgvector DB | AlloyDB | Azure DB for PostgreSQL Flexible Server + `pgvector` | local `pgvector/pgvector` container | **env** (`DATABASE_URL`/`ALLOYDB_*`) |
| C6 Redis | Memorystore | Azure Cache for Redis (TLS :6380) | local `redis:7` | **env** (`REDIS_ADDR` + TLS flag) |
| C7 Pub/Sub | Pub/Sub | **Pub/Sub emulator container** (portable) or Service Bus | Pub/Sub emulator container | **env** (emulator) / **adapter** (Service Bus) |
| C8 Secrets | Secret Manager | Key Vault, or env injection | env / file injection | **env** (inject) / **adapter** (Key Vault) |
| C9 Maps | Maps MCP + key | Azure Maps (adapter) or **off** (cached routes) | **off** (cached routes) | **degrade / adapter** |
| C10 Artifacts | GCS | Azure Blob | local filesystem | **adapter** (only if artifacts used) |
| C11 Hosting | Cloud Run + Agent Engine | Container Apps / AKS | Docker Compose on the box | **per‑target IaC** |
| C12 Safety | Model Armor | Azure AI Content Safety | off | **degrade / adapter** |

**Bottom line:** C1, C5, C6, C7 (the load‑bearing ones) are **env‑only**. C2/C8
need small, well‑scoped adapters. C3/C4/C9/C12 already **degrade** gracefully
when GCP‑only services are absent (heuristic eval, in‑DB/in‑memory memory, cached
routes). So a working Azure or GPU‑Server deployment is mostly a **profile + two
adapters**.

---

## 3. The harness mechanism

A single selector, `DEPLOY_TARGET ∈ {gcp, azure, gpu}`, chooses an **env profile**
that sets every swappable knob:

```
deploy/harness/
├── README.md
└── profiles/
    ├── gcp.env      # Vertex + Memorystore + AlloyDB + Pub/Sub + Secret Manager
    ├── azure.env    # Azure OpenAI + Azure Cache + Azure PG + emulator + KV/env
    └── gpu.env      # vLLM/Ollama + local Redis + local PG + emulator + file secrets
```

Load a profile before starting the stack (local/compose or container env):

```bash
# example: bring up the self-hosted GPU harness
set -a; . deploy/harness/profiles/gpu.env; set +a
docker compose up -d              # infra + (future) app services
```

Each profile only sets **standard app env vars** already read by the code
(`RUNNER_MODEL`, `OPENAI_API_BASE`, `REDIS_ADDR`, `DATABASE_URL`/`ALLOYDB_*`,
`PUBSUB_EMULATOR_HOST`, `GOOGLE_GENAI_USE_VERTEXAI`, …). No forking required for
the env‑swappable capabilities.

### 3.1 The model plane (C1) — already swappable

`agents/runner/agent.py` selects the backend from `RUNNER_MODEL`:
- `gemini-*` → Vertex/Gemini
- `azure/<deployment>` → **Azure OpenAI** (LiteLLM native; set `AZURE_API_KEY`,
  `AZURE_API_BASE`, `AZURE_API_VERSION`)
- `openai/<model>` + `OPENAI_API_BASE` → **vLLM** or any OpenAI‑compatible proxy
- `ollama_chat/<model>` → **Ollama**

The **planner** and **simulator** currently hardcode Gemini; making them honor a
`PLANNER_MODEL`/`SIM_MODEL` the same way is the one model‑plane code change needed
for a fully Gemini‑free live run (see [SYSTEM-DESIGN.md](../SYSTEM-DESIGN.md) §6).

### 3.2 Code adapters to implement for non‑GCP

Small, isolated seams. Each is a factory keyed off `DEPLOY_TARGET` / a backend env.

| Adapter | Seam | GCP impl (exists) | Azure impl | GPU impl |
|---|---|---|---|---|
| **Embeddings** (C2) | `agents/planner_with_memory` `_resolve_embedding_backend()` (already returns `vertex_ai`) | Vertex embeddings | Azure OpenAI embeddings (`azure/<embed-deployment>`) | local model (sentence‑transformers / vLLM `/v1/embeddings`) |
| **Secrets** (C8) | `agents/planner/adk_tools.py` key resolver (env → Secret Manager) | Secret Manager | Key Vault SDK | env/file |
| **Telemetry bus** (C7) | GCP Pub/Sub client (Go `internal/…`, Python `agents/utils`) | Pub/Sub | run the **emulator container** (no code) or a Service Bus adapter | emulator container |

The recommended cross‑cloud path for C7 is to **run the Pub/Sub emulator
container** on Azure/GPU (it is provider‑neutral and already used for local dev),
avoiding a Service Bus rewrite. A Service Bus adapter is only worth it for
managed‑service SLAs.

---

## 4. Per‑target harnesses

### 4.1 GCP (existing)
Native. Provisioned by [infra/](../infra/) (Terraform → Cloud Run + Agent Engine
+ Memorystore + AlloyDB + Pub/Sub). Profile: `profiles/gcp.env`. Nothing new
needed — this is the reference implementation.

### 4.2 Azure
Target compute: **Azure Container Apps** (or AKS for GPU model hosting).

| Capability | Azure service | Binding |
|---|---|---|
| LLM (C1) | **Azure OpenAI** | `RUNNER_MODEL=azure/<deployment>` + `AZURE_API_*` |
| Embeddings (C2) | Azure OpenAI embeddings | embeddings adapter → `azure/<embed-deployment>` |
| pgvector (C5) | **Azure DB for PostgreSQL Flexible Server** (`CREATE EXTENSION vector`) | `DATABASE_URL=postgresql://…` |
| Redis (C6) | **Azure Cache for Redis** | `REDIS_ADDR=<host>:6380` + `REDIS_TLS=true` |
| Pub/Sub (C7) | Pub/Sub **emulator** container (recommended) or Service Bus adapter | `PUBSUB_EMULATOR_HOST=pubsub:8085` |
| Secrets (C8) | **Key Vault** (adapter) or Container Apps secrets | inject as env |
| Maps (C9) | off (cached routes) or Azure Maps adapter | `GOOGLE_MAPS_API_KEY` unset |
| Hosting (C11) | Container Apps + Bicep/azd | see `profiles/azure.env` |

Provisioning starter (to author): `deploy/harness/azure/` Bicep or `azd` for the
ACA environment + Azure OpenAI + Postgres Flexible Server + Cache for Redis, with
env wired from the profile. Model hosting can also be **self‑hosted GPU on AKS**
(vLLM), in which case C1/C2 use the GPU‑server path instead of Azure OpenAI.

### 4.3 GPU‑Server (self‑hosted, no cloud)
A single box (or a couple) running Docker. Mirrors [SYSTEM-DESIGN.md](../SYSTEM-DESIGN.md)
Option B, plus GPU model serving.

| Capability | Local service | Binding |
|---|---|---|
| LLM (C1) | **vLLM** (OpenAI‑compatible) or **Ollama** | `RUNNER_MODEL=openai/<model>` + `OPENAI_API_BASE=http://vllm:8000/v1`, or `ollama_chat/<model>` |
| Embeddings (C2) | vLLM `/v1/embeddings` or sentence‑transformers | embeddings adapter → local |
| pgvector (C5) | `pgvector/pgvector:pg16` container | `ALLOYDB_*` / `DATABASE_URL` → local PG |
| Redis (C6) | `redis:7` container | `REDIS_ADDR=redis:6379` |
| Pub/Sub (C7) | Pub/Sub emulator container | `PUBSUB_EMULATOR_HOST=pubsub:8085` |
| Secrets (C8) | `.env` / file | injected |
| Maps (C9) | off (cached routes) | unset |
| Hosting (C11) | Docker Compose on the box, behind your proxy | `profiles/gpu.env` |

This is the **cheapest** path and needs **no cloud account** — models run on your
GPU, everything else in containers. It reuses the local‑dev infra
([docker-compose.yml](../docker-compose.yml)) plus a model server.

---

## 5. What ships in this change

- This document.
- [deploy/harness/README.md](../deploy/harness/README.md) — how to select/load a harness.
- [deploy/harness/profiles/gcp.env](../deploy/harness/profiles/gcp.env),
  [azure.env](../deploy/harness/profiles/azure.env),
  [gpu.env](../deploy/harness/profiles/gpu.env) — the swappable env profiles.

### Follow‑up code work (scoped, not in this change)
1. Embeddings adapter: add `azure` + `local` backends to
   `planner_with_memory` `_resolve_embedding_backend()`.
2. Secrets adapter: add Key Vault / env branches to the key resolver in
   `agents/planner/adk_tools.py`.
3. `PLANNER_MODEL` / `SIM_MODEL` env‑gating (mirror the runner) for a fully
   Gemini‑free live run.
4. Azure `deploy/harness/azure/` IaC (Bicep/azd) and a GPU `docker-compose.app.yml`
   (per SYSTEM‑DESIGN §4) with `--profile gpu`.
