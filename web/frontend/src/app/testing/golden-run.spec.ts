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
 * Golden-run harness tests. These assert determinism and behavioral invariants
 * that must hold for the Vegas marathon, so any accidental drift in the physics
 * constants or scenario defaults fails CI. A deliberate behavioral change is
 * expected to update the pinned signature on purpose.
 */
import { describe, it, expect } from 'vitest';
import { VEGAS_MARATHON_ROUTE } from '../scenarios/route';
import {
  VEGAS_GOLDEN_CONFIG,
  simulateGoldenRun,
  goldenRunSignature,
} from './golden-run';

describe('golden-run harness', () => {
  it('is deterministic for a fixed seed + config', () => {
    expect(simulateGoldenRun(VEGAS_GOLDEN_CONFIG)).toEqual(
      simulateGoldenRun(VEGAS_GOLDEN_CONFIG),
    );
    expect(goldenRunSignature(VEGAS_GOLDEN_CONFIG)).toBe(
      goldenRunSignature(VEGAS_GOLDEN_CONFIG),
    );
  });

  it('clamps distance at the active route distance (guards 26.2188)', () => {
    // All agents fast enough to finish → every final distance is the clamp.
    const finals = simulateGoldenRun({
      ...VEGAS_GOLDEN_CONFIG,
      minMph: 8,
      maxMph: 11,
      ticks: 40,
    });
    for (const d of finals) {
      expect(d).toBe(VEGAS_MARATHON_ROUTE.distanceMi);
    }
    expect(VEGAS_MARATHON_ROUTE.distanceMi).toBe(26.2188);
  });

  it('cohesion 0 (Vegas) is grouping-independent — the render-identical guarantee', () => {
    const grouped = simulateGoldenRun({ ...VEGAS_GOLDEN_CONFIG, cohesionTarget: 0, groupSize: 4 });
    const ungrouped = simulateGoldenRun({ ...VEGAS_GOLDEN_CONFIG, cohesionTarget: 0, groupSize: 1 });
    expect(grouped).toEqual(ungrouped);
  });

  it('cohesion 1 never speeds an agent up and slows at least one', () => {
    const independent = simulateGoldenRun({ ...VEGAS_GOLDEN_CONFIG, cohesionTarget: 0 });
    const cohered = simulateGoldenRun({ ...VEGAS_GOLDEN_CONFIG, cohesionTarget: 1 });
    let anySlower = false;
    for (let i = 0; i < independent.length; i++) {
      expect(cohered[i]).toBeLessThanOrEqual(independent[i] + 1e-9);
      if (cohered[i] < independent[i] - 1e-9) anySlower = true;
    }
    expect(anySlower).toBe(true);
  });

  it('signature is sensitive to a behavioral change', () => {
    const base = goldenRunSignature(VEGAS_GOLDEN_CONFIG);
    const changed = goldenRunSignature({ ...VEGAS_GOLDEN_CONFIG, cohesionTarget: 1 });
    expect(base).not.toBe(changed);
  });
});
