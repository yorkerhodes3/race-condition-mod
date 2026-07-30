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
 * Regression guard for the P6 Speed/Movement-mode seam. Asserts the Vegas
 * default is foot-only (single-mode marathon), so mode gating is inert.
 */
import { describe, it, expect } from 'vitest';
import {
  VEGAS_FOOT_ONLY,
  getActiveMovementModel,
  DEFAULT_MOVEMENT_MODE_MODEL_ID,
  isModeEnabled,
  MOVEMENT_MODES,
  MODE_PROFILES,
  FOOT_PROFILE,
} from './mode';

import { MARIUPOL_MIXED, MOVEMENT_MODE_MODELS } from './mode';

describe('Movement-mode seam (P6 sim-parity guard)', () => {
  it('defaults Vegas to a single foot mode (the marathon)', () => {
    expect(VEGAS_FOOT_ONLY.enabledModes).toEqual(['foot']);
    expect(VEGAS_FOOT_ONLY.defaultMode).toBe('foot');
    expect(DEFAULT_MOVEMENT_MODE_MODEL_ID).toBe('vegas-foot');
    expect(getActiveMovementModel().id).toBe('vegas-foot');
  });

  it('enables only foot for Vegas; reserved modes are declared but disabled', () => {
    expect(isModeEnabled(VEGAS_FOOT_ONLY, 'foot')).toBe(true);
    for (const m of ['car', 'bus', 'train'] as const) {
      expect(isModeEnabled(VEGAS_FOOT_ONLY, m)).toBe(false);
    }
  });

  it('declares a profile for every movement mode', () => {
    expect(MOVEMENT_MODES).toEqual(['foot', 'car', 'bus', 'train']);
    for (const m of MOVEMENT_MODES) {
      expect(MODE_PROFILES[m].mode).toBe(m);
      expect(MODE_PROFILES[m].maxMph).toBeGreaterThanOrEqual(MODE_PROFILES[m].minMph);
    }
    // Foot is the only pedestrian (non-road-restricted) mode.
    expect(FOOT_PROFILE.roadsOnly).toBe(false);
    expect(FOOT_PROFILE.capacity).toBe(1);
  });

  it('registers the Mariupol mixed mode (foot+bus) and keeps Vegas default', () => {
    expect(MOVEMENT_MODE_MODELS['mariupol-mixed']).toBe(MARIUPOL_MIXED);
    expect(MARIUPOL_MIXED.enabledModes).toEqual(['foot', 'bus']);
  });
});
