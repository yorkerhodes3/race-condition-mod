# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Client-side embedding helper for OSS deployments without AlloyDB ai.embedding().

Cloud SQL Postgres lacks AlloyDB's ai.embedding() / ai.initialize_embeddings
extension, so OSS deployments must compute embeddings client-side. Selected by
EMBEDDING_BACKEND on the calling code:
  - vertex_ai (default) → Vertex AI / Gemini via google-genai
  - azure               → Azure OpenAI via LiteLLM
  - local / openai      → any OpenAI-compatible / vLLM server via LiteLLM
"""

from __future__ import annotations

import os
from functools import lru_cache

from google import genai


@lru_cache(maxsize=1)
def _get_genai_client() -> genai.Client:
    """Process-global google-genai client. Vertex AI when a project is set,
    otherwise API-key auth (local dev with GEMINI_API_KEY)."""
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("PROJECT_ID")
    if project:
        return genai.Client(
            vertexai=True,
            project=project,
            location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"),
        )
    return genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))


async def compute_embedding(text: str, *, dimension: int = 3072) -> list[float]:
    """Compute an embedding for ``text``.

    Provider is selected by ``EMBEDDING_BACKEND``:
      - unset / ``vertex_ai`` → Vertex AI / Gemini via google-genai (default).
      - ``azure`` → Azure OpenAI embeddings via LiteLLM.
      - ``local`` / ``openai`` → any OpenAI-compatible / vLLM server via LiteLLM.

    Default dimension 3072 matches the ``VECTOR(3072)`` column in
    ``planner_with_memory`` schemas. NOTE: if you point at a model whose native
    dimension differs (e.g. a small local model), you must request a 3072‑dim
    model (Azure ``text-embedding-3-large`` supports ``dimensions``) or migrate
    the vector column. Errors propagate; callers decide retry/fallback policy.
    """
    provider = os.environ.get("EMBEDDING_BACKEND", "").lower()
    if provider in ("azure", "local", "openai"):
        return await _compute_via_litellm(text, dimension=dimension, provider=provider)

    client = _get_genai_client()
    model = os.environ.get("EMBEDDING_MODEL", "gemini-embedding-001")
    response = await client.aio.models.embed_content(
        model=model,
        contents=text,
        config={"output_dimensionality": dimension},
    )
    if not response.embeddings:
        raise RuntimeError(f"embed_content returned no embeddings for model={model}")
    values = response.embeddings[0].values
    if values is None:
        raise RuntimeError(f"embed_content returned embedding with no values for model={model}")
    return list(values)


async def _compute_via_litellm(text: str, *, dimension: int, provider: str) -> list[float]:
    """Embeddings via LiteLLM for the Azure / GPU‑server deployment harnesses.

    Azure OpenAI (``EMBEDDING_BACKEND=azure``) uses ``AZURE_API_BASE/KEY/VERSION``
    and ``AZURE_EMBEDDING_DEPLOYMENT``. A local / OpenAI‑compatible server
    (``EMBEDDING_BACKEND=local``) uses ``LOCAL_EMBEDDING_URL`` (or
    ``OPENAI_API_BASE``) and ``LOCAL_EMBEDDING_MODEL``.
    """
    import litellm  # lazy: litellm ships with google-adk but is heavy to import

    # Drop provider params a given model doesn't support (e.g. `dimensions` on a
    # local model that has a fixed output size) instead of erroring.
    litellm.drop_params = True

    kwargs: dict[str, object] = {"input": [text]}
    if provider == "azure":
        deployment = os.environ.get("AZURE_EMBEDDING_DEPLOYMENT", "text-embedding-3-large")
        model = deployment if deployment.startswith("azure/") else f"azure/{deployment}"
        for env_key, lk in (
            ("AZURE_API_BASE", "api_base"),
            ("AZURE_API_KEY", "api_key"),
            ("AZURE_API_VERSION", "api_version"),
        ):
            val = os.environ.get(env_key)
            if val:
                kwargs[lk] = val
        # Azure text-embedding-3-* supports requesting an output dimension.
        kwargs["dimensions"] = dimension
    else:  # local / openai-compatible (vLLM, LM Studio, LiteLLM proxy, …)
        name = os.environ.get("LOCAL_EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
        model = name if name.startswith(("openai/", "hosted_vllm/")) else f"openai/{name}"
        api_base = os.environ.get("LOCAL_EMBEDDING_URL") or os.environ.get("OPENAI_API_BASE")
        if api_base:
            kwargs["api_base"] = api_base
        kwargs["api_key"] = os.environ.get("OPENAI_API_KEY", "not-needed")

    response = await litellm.aembedding(model=model, **kwargs)
    data = response["data"]
    if not data:
        raise RuntimeError(f"aembedding returned no data for model={model}")
    values = data[0]["embedding"]
    if not values:
        raise RuntimeError(f"aembedding returned empty embedding for model={model}")
    return list(values)
