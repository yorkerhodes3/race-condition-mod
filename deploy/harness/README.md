# Deployment Harnesses

Swappable, provider‑agnostic deployment profiles for the Race Condition backend.
One selector — `DEPLOY_TARGET ∈ {gcp, azure, gpu}` — picks an env profile that
binds every swappable dependency (LLM, embeddings, vector DB, Redis, Pub/Sub,
secrets) to that provider.

Full design, dependency inventory, and capability matrix:
[docs/deployment-harnesses.md](../../docs/deployment-harnesses.md).

## Targets

| Target | Models | Vector DB | Redis | Pub/Sub | Cost |
|---|---|---|---|---|---|
| `gcp` (existing) | Vertex/Gemini | AlloyDB | Memorystore | Pub/Sub | cloud |
| `azure` | Azure OpenAI (or AKS vLLM) | Azure PG Flexible + pgvector | Azure Cache | emulator/Service Bus | cloud |
| `gpu` | vLLM / Ollama (your GPU) | local pgvector | local Redis | emulator | self‑hosted, no cloud |

## Usage

Load a profile into the environment before starting the stack:

```bash
# self-hosted GPU box
set -a; . deploy/harness/profiles/gpu.env; set +a
docker compose up -d        # local infra (redis, pubsub emulator, postgres)
# + your model server (vLLM/Ollama) and the app services

# Azure
set -a; . deploy/harness/profiles/azure.env; set +a   # fill in the <PLACEHOLDERS> first

# GCP (reference)
set -a; . deploy/harness/profiles/gcp.env; set +a
```

PowerShell:

```powershell
Get-Content deploy/harness/profiles/gpu.env |
  Where-Object { $_ -and $_ -notmatch '^\s*#' } |
  ForEach-Object { $k,$v = $_ -split '=',2; [Environment]::SetEnvironmentVariable($k,$v) }
```

## What's env‑swappable vs. needs a code adapter

- **Env‑only (no code):** LLM backend (`RUNNER_MODEL` via LiteLLM `gemini`/`azure`/
  `openai`/`ollama`), Redis (`REDIS_ADDR`), Postgres+pgvector
  (`DATABASE_URL`/`ALLOYDB_*`), Pub/Sub (run the emulator container anywhere).
- **Small adapter needed for non‑GCP:** embeddings backend (add `azure`/`local`),
  secrets (Key Vault/env), and — only if you want managed Service Bus instead of
  the emulator — a Pub/Sub adapter.
- **Auto‑degrades off‑GCP:** LLM‑as‑judge eval (heuristic fallback), agent Memory
  Bank (DB/in‑memory store), Maps grounding (cached routes), content safety.

See the design doc for the exact seams and the scoped follow‑up list.

> Secrets: these profiles contain **placeholders only** — never commit real keys.
> Inject secrets via your platform (Container Apps secrets, Key Vault, `.env`
> that stays gitignored).
