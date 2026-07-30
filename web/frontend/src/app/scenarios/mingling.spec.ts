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
 * Regression guard for the P5 Mingling seam. Asserts the Vegas default is "no
 * mingling" and that every primitive is an exact no-op at the zero defaults, so
 * agents pass decision points exactly as before.
 */
import { describe, it, expect } from 'vitest';
import {
  VEGAS_NO_MINGLING,
  getActiveMinglingModel,
  DEFAULT_MINGLING_MODEL_ID,
  mingleDwellTicks,
  blendBelief,
  noisyObservation,
} from './mingling';

import { MARIUPOL_SIEGE_MINGLING, MINGLING_MODELS } from './mingling';

describe('Mingling seam (P5 sim-parity guard)', () => {
  it('defaults Vegas to no mingling (all zero)', () => {
    expect(VEGAS_NO_MINGLING.defaultMingle).toBe(0);
    expect(VEGAS_NO_MINGLING.defaultDwellTicks).toBe(0);
    expect(VEGAS_NO_MINGLING.infoNoise).toBe(0);
    expect(DEFAULT_MINGLING_MODEL_ID).toBe('vegas-none');
    expect(getActiveMinglingModel().id).toBe('vegas-none');
  });

  it('primitives are exact no-ops at the zero defaults (render/sim-identical)', () => {
    expect(mingleDwellTicks(0, 0, 0.999)).toBe(0);
    expect(mingleDwellTicks(0, 5, 0.0)).toBe(0);
    expect(blendBelief(0.3, 0.9, 0)).toBe(0.3);
    expect(noisyObservation(0.42, 0, 0.99)).toBe(0.42);
  });

  it('mingling dwells only when the roll falls under the probability', () => {
    expect(mingleDwellTicks(0.5, 3, 0.4)).toBe(3);
    expect(mingleDwellTicks(0.5, 3, 0.6)).toBe(0);
  });

  it('belief moves toward observation; noise perturbs truth within bounds', () => {
    expect(blendBelief(0.2, 1.0, 0.5)).toBeCloseTo(0.6, 10);
    expect(noisyObservation(0.5, 0.5, 1)).toBeCloseTo(1.0, 10);
    expect(noisyObservation(0.5, 0.5, 0.25)).toBeCloseTo(0.25, 10);
    // Never leaves [0,1].
    expect(noisyObservation(0.9, 1, 1)).toBe(1);
    expect(noisyObservation(0.1, 1, 0)).toBe(0);
  });

  it('registers the Mariupol siege mingling model and keeps Vegas default', () => {
    expect(MINGLING_MODELS['mariupol-siege']).toBe(MARIUPOL_SIEGE_MINGLING);
    expect(MARIUPOL_SIEGE_MINGLING.infoNoise).toBe(0.4);
  });
});
