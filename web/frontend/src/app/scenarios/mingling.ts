/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Mingling / information-at-decision-points model
 * (see docs/DESIGN-CHANGES-SITE-Purpose.md §4.7).
 *
 * At decision points (route forks, assembly points, checkpoints) evacuees pause,
 * exchange noisy information, and update their belief about which corridor is
 * open — the mechanism ETC's Evac-Sim-Melanie (information spread) and
 * India-EvacSimulation (decisions under uncertainty) both center on. The Vegas
 * marathon has no mingling: agents pass decision points without dwelling, so
 * the default is an exact no-op.
 *
 * This module is pure: no three.js, no DOM. Safe to import from the browser
 * bundle and the node/vitest parity guards.
 */

/** Clamp to [0, 1]. */
function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Scenario mingling parameters. `defaultMingle` is the per-agent probability of
 * dwelling at a decision point; `infoNoise` is the error in sampled information.
 */
export interface MinglingModel {
  readonly id: string;
  readonly name: string;
  /** Probability [0,1] an agent dwells/mingles at a decision point. */
  readonly defaultMingle: number;
  /** Ticks an agent dwells when it mingles. */
  readonly defaultDwellTicks: number;
  /** Noise [0,1] applied to sampled route-openness information. */
  readonly infoNoise: number;
}

/** Las Vegas: no mingling. Every field 0 → agents pass decision points as today. */
export const VEGAS_NO_MINGLING: MinglingModel = {
  id: 'vegas-none',
  name: 'No mingling (pass-through)',
  defaultMingle: 0,
  defaultDwellTicks: 0,
  infoNoise: 0,
};

/**
 * Mariupol siege information (P7) — evacuees dwell at decision points and act on
 * noisy, uncertain reports of which corridor is open (grounds ETC's
 * India-EvacSimulation / Evac-Sim-Melanie). Values are synthetic starting
 * points. Opt-in via `?mingle=mariupol-siege`; Vegas is unaffected.
 */
export const MARIUPOL_SIEGE_MINGLING: MinglingModel = {
  id: 'mariupol-siege',
  name: 'Siege information (noisy)',
  defaultMingle: 0.6,
  defaultDwellTicks: 2,
  infoNoise: 0.4,
};

/** Registry of known mingling models. */
export const MINGLING_MODELS: Readonly<Record<string, MinglingModel>> = {
  [VEGAS_NO_MINGLING.id]: VEGAS_NO_MINGLING,
  [MARIUPOL_SIEGE_MINGLING.id]: MARIUPOL_SIEGE_MINGLING,
};

export const DEFAULT_MINGLING_MODEL_ID = 'vegas-none';

/**
 * Resolve the active mingling model id from (1) `?mingle=`, then
 * (2) `window.ENV.MINGLING`, defaulting to the no-mingling Vegas model. Guarded
 * for node/vitest where `window` is absent.
 */
export function resolveMinglingModelId(): string {
  if (typeof window !== 'undefined') {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get('mingle');
      if (fromQuery && MINGLING_MODELS[fromQuery]) {
        return fromQuery;
      }
      const env = (window as unknown as { ENV?: { MINGLING?: string } }).ENV;
      if (env?.MINGLING && MINGLING_MODELS[env.MINGLING]) {
        return env.MINGLING;
      }
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT_MINGLING_MODEL_ID;
}

let _activeMinglingModel: MinglingModel | null = null;

/** The active mingling model, resolved once and cached. */
export function getActiveMinglingModel(): MinglingModel {
  if (_activeMinglingModel === null) {
    _activeMinglingModel = MINGLING_MODELS[resolveMinglingModelId()] ?? VEGAS_NO_MINGLING;
  }
  return _activeMinglingModel;
}

/**
 * Ticks an agent dwells at a decision point. Returns 0 (no dwell — today's
 * behavior) when `mingleProb <= 0` or `dwellTicks <= 0`. Otherwise dwells for
 * `floor(dwellTicks)` when the roll (a [0,1) draw) falls under `mingleProb`.
 */
export function mingleDwellTicks(
  mingleProb: number,
  dwellTicks: number,
  roll: number,
): number {
  if (!(mingleProb > 0) || !(dwellTicks > 0)) {
    return 0;
  }
  return roll < mingleProb ? Math.max(0, Math.floor(dwellTicks)) : 0;
}

/**
 * Noisy belief update: move `prior` toward a sampled `observation` by `weight`.
 * At `weight <= 0` returns the (clamped) prior unchanged — the no-op default.
 * All values are treated as probabilities in [0,1].
 */
export function blendBelief(prior: number, observation: number, weight: number): number {
  if (!(weight > 0)) {
    return clamp01(prior);
  }
  const w = Math.min(1, weight);
  return clamp01(prior + w * (clamp01(observation) - clamp01(prior)));
}

/**
 * Apply information noise to a ground-truth signal in [0,1]. `roll` is a [0,1)
 * draw mapped to [-1,1]. At `noise <= 0` returns the exact truth (no-op).
 */
export function noisyObservation(truth: number, noise: number, roll: number): number {
  if (!(noise > 0)) {
    return clamp01(truth);
  }
  const signed = roll * 2 - 1;
  return clamp01(truth + Math.min(1, noise) * signed);
}
