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
 * Regression guard for the P4 Group Cohesion seam. Asserts the Vegas default is
 * "no groups" (cohesion 0) and that the cohesion speed factor is an exact no-op
 * at cohesion 0, so the marathon field moves exactly as before.
 */
import { describe, it, expect } from 'vitest';
import {
  VEGAS_NO_GROUPS,
  getActiveGroupModel,
  DEFAULT_GROUP_MODEL_ID,
  cohesionSpeedFactor,
} from './group';

describe('Group cohesion seam (P4 sim-parity guard)', () => {
  it('defaults Vegas to independent runners with zero cohesion', () => {
    expect(VEGAS_NO_GROUPS.defaultCohesionTarget).toBe(0);
    expect(DEFAULT_GROUP_MODEL_ID).toBe('vegas-independent');
    expect(getActiveGroupModel().id).toBe('vegas-independent');
    expect(getActiveGroupModel().defaultCohesionTarget).toBe(0);
  });

  it('cohesionSpeedFactor is an exact no-op at cohesion 0 (render/sim-identical)', () => {
    expect(cohesionSpeedFactor(0, 8, 4)).toBe(1);
    expect(cohesionSpeedFactor(0, 8, 0.0001)).toBe(1);
    // Degenerate inputs never throttle.
    expect(cohesionSpeedFactor(1, 0, 4)).toBe(1);
    expect(cohesionSpeedFactor(1, 8, NaN)).toBe(1);
  });

  it('cohesionSpeedFactor paces toward the slowest member as cohesion rises', () => {
    // Fully paced to slowest: 4 / 8 = 0.5.
    expect(cohesionSpeedFactor(1, 8, 4)).toBeCloseTo(0.5, 10);
    // Half cohesion: halfway between own pace (1) and slowest ratio (0.5).
    expect(cohesionSpeedFactor(0.5, 8, 4)).toBeCloseTo(0.75, 10);
    // A member no slower than self never speeds you up past your own pace.
    expect(cohesionSpeedFactor(1, 8, 12)).toBe(1);
  });
});
