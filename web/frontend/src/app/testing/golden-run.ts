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
 * Golden-run validation harness.
 *
 * A deterministic, dependency-free (no three.js / no DOM) reimplementation of
 * the runner distance-integration core, wired through the same scenario seams
 * the live engine uses:
 *   - route distance   → scenarios/route.ts (clamp target)
 *   - group cohesion    → scenarios/group.ts (pace-to-slowest factor)
 *   - sim integrator    → runner-sim-constants.ts
 *
 * The point is a machine-checkable invariant: for a fixed seed + config the
 * per-agent distance trajectory (and its {@link goldenRunSignature}) is stable.
 * A render-identical change leaves the signature untouched; a deliberate
 * behavioral change updates it on purpose. This catches accidental drift in the
 * physics constants or scenario defaults that constant-equality specs would
 * miss.
 */
import { RUNNER_DEFAULT_SIM_SPEED } from '../runner-sim-constants';
import { VEGAS_MARATHON_ROUTE, MARIUPOL_CORRIDOR_ROUTE } from '../scenarios/route';
import { VEGAS_NO_GROUPS, MARIUPOL_HOUSEHOLDS, cohesionSpeedFactor } from '../scenarios/group';

/** Same integrator the Runner uses by default: simulated-distance per real second. */
export const GOLDEN_INTEGRATOR = RUNNER_DEFAULT_SIM_SPEED / 3600;

export interface GoldenRunConfig {
  /** PRNG seed — fixes the per-agent base speeds. */
  readonly seed: number;
  /** Number of agents. */
  readonly agents: number;
  /** Members per group (agents are chunked into groups of this size). */
  readonly groupSize: number;
  /** Number of ticks to integrate. */
  readonly ticks: number;
  /** Real seconds per tick. */
  readonly dtSeconds: number;
  /** Cohesion strength in [0,1]; 0 = independent (Vegas). */
  readonly cohesionTarget: number;
  /** Course distance in miles (clamp target). */
  readonly distanceMi: number;
  /** Inclusive speed band in mph for the seeded base speeds. */
  readonly minMph: number;
  readonly maxMph: number;
}

/**
 * Vegas defaults, sourced from the scenario seams. `cohesionTarget` is the
 * marathon default (0 → independent runners).
 */
export const VEGAS_GOLDEN_CONFIG: GoldenRunConfig = {
  seed: 0x9e3779b9,
  agents: 64,
  groupSize: 4,
  ticks: 40,
  dtSeconds: 1,
  cohesionTarget: VEGAS_NO_GROUPS.defaultCohesionTarget,
  distanceMi: VEGAS_MARATHON_ROUTE.distanceMi,
  minMph: 4,
  maxMph: 11,
};

/**
 * Mariupol evacuation profile (P7): the long single corridor with high household
 * cohesion. Deterministic signature distinct from Vegas; guards the Mariupol
 * route distance + cohesion default.
 */
export const MARIUPOL_GOLDEN_CONFIG: GoldenRunConfig = {
  seed: 0x1a2b3c4d,
  agents: 64,
  groupSize: 4,
  ticks: 40,
  dtSeconds: 1,
  cohesionTarget: MARIUPOL_HOUSEHOLDS.defaultCohesionTarget,
  distanceMi: MARIUPOL_CORRIDOR_ROUTE.distanceMi,
  minMph: 2,
  maxMph: 13,
};

/** Deterministic 32-bit PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run the deterministic simulation and return each agent's final distance in
 * miles, rounded to 6 decimals for stable comparison/hashing.
 */
export function simulateGoldenRun(config: GoldenRunConfig): number[] {
  const rng = mulberry32(config.seed);
  const baseMph: number[] = new Array(config.agents);
  for (let i = 0; i < config.agents; i++) {
    baseMph[i] = config.minMph + rng() * (config.maxMph - config.minMph);
  }
  const distance: number[] = new Array(config.agents).fill(0);
  const groupSize = Math.max(1, config.groupSize);

  for (let tick = 0; tick < config.ticks; tick++) {
    for (let g = 0; g < config.agents; g += groupSize) {
      const end = Math.min(config.agents, g + groupSize);
      // Slowest still-moving member of the group sets the cohesion pace.
      let slowest = Infinity;
      for (let i = g; i < end; i++) {
        if (distance[i] < config.distanceMi && baseMph[i] < slowest) {
          slowest = baseMph[i];
        }
      }
      if (!Number.isFinite(slowest)) slowest = 0;
      for (let i = g; i < end; i++) {
        if (distance[i] >= config.distanceMi) continue;
        const factor = cohesionSpeedFactor(config.cohesionTarget, baseMph[i], slowest);
        const mph = baseMph[i] * factor;
        const deltaMi = mph * GOLDEN_INTEGRATOR * config.dtSeconds;
        distance[i] = Math.min(config.distanceMi, distance[i] + deltaMi);
      }
    }
  }
  return distance.map((d) => Math.round(d * 1e6) / 1e6);
}

/**
 * FNV-1a hex signature over a golden run's distances. Stable across runs for a
 * fixed config; changes only when the trajectory changes.
 */
export function goldenRunSignature(config: GoldenRunConfig): string {
  const distances = simulateGoldenRun(config);
  let h = 0x811c9dc5;
  const str = distances.join(',');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
