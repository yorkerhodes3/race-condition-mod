# Backlog / Monitoring

Lightweight running list of known issues and deferred work to monitor. Newest
first. For the larger evacuation-twin design, see
[DESIGN-CHANGES-SITE-Purpose.md](DESIGN-CHANGES-SITE-Purpose.md).

---

## MON-1 — Residual end-of-race "freeze" (monitor)

**Status:** open · low severity · UX polish
**Observed:** 2026-07-29 on the live site (demo 4, 1k-runner field).
**Symptom:** a slight freeze/hold of the field at the very end of the marathon,
just before the finish/wrap-up sequence.

**Context — already mitigated (commit `881535f` / `98711bd`):**
- 1a: the replay gap-clamp in
  [agent-gateway-message-dump.ts](../web/frontend/agent-gateway-message-dump.ts)
  (`parseAgentGatewayMsgNdjsonInterFrameReplayMeta`) now collapses long gaps to
  one tick interval when **either** endpoint is sim-timed, inside the marathon
  window `[fire_start_gun … check_race_complete]`.
- 1b: the raw tail gap in
  [1k-runners.ndjson](../web/frontend/public/assets/1k-runners.ndjson) was
  trimmed from ~16.8s to 3.0s.

**Why a small freeze remains (hypotheses to confirm):**
1. **Inherent finish-line clamp.** Runners clamp at `t=1.0` and hold status
   `running` until the backend/replay confirms `finished`
   ([runner.ts](../web/frontend/src/app/runner.ts) `tick()`), so the fastest
   runners visibly sit at the line while the pack arrives.
2. **Post-window wrap-up gaps.** Frames after `check_race_complete`
   (`compile_results`, `stop_race_collector`, trailing `model_end`s) sit
   **outside** the marathon window, so the ~2–2.7s gaps between them are **not**
   clamped and replay verbatim.
3. **The 3.0s leading gap** left by 1b is still a visible beat.

**Options when picked up:**
- Also clamp (or floor) post-`check_race_complete` wrap-up gaps.
- Trim the 1b tail gap further (e.g. ~1s) and/or compress wrap-up frame spacing.
- Start the post-finish camera/overview sequence as soon as the **leaders**
  finish, rather than waiting for the whole field
  ([viewport-lookdev.component.ts](../web/frontend/src/app/viewport/viewport-lookdev.component.ts)
  `startPostFinishSequence` / `_simAllFinished`).
- Make runners visually **cross and exit** the finish line instead of piling on
  it at `t=1.0`.

**How to reproduce / measure:** load the site (default demo 4), watch the last
~20s; or inspect tail inter-frame gaps in the recording (search for the
`process_tick → model_start → check_race_complete` transition).
