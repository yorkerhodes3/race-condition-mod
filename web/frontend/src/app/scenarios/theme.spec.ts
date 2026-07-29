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
 * Regression guard for the P1 Theme Pack refactor. Asserts the neon-night Vegas
 * theme holds the EXACT tone literals that were inlined before the refactor, so
 * the scene renders identically.
 */
import { describe, it, expect } from 'vitest';
import { VEGAS_NEON_THEME, getActiveTheme, DEFAULT_THEME_ID } from './theme';

describe('Vegas neon Theme Pack (P1 render-parity guard)', () => {
  it('preserves the pre-refactor bloom parameters', () => {
    expect(VEGAS_NEON_THEME.bloom).toEqual({ strength: 0.12, radius: 0.5, threshold: 0.02 });
  });

  it('preserves the pre-refactor road emissive', () => {
    expect(VEGAS_NEON_THEME.roadEmissive).toEqual({ color: 0x334455, intensity: 0.4 });
  });

  it('preserves the pre-refactor window glow color', () => {
    expect(VEGAS_NEON_THEME.windowGlowColor).toBe(0xb0bcbf);
  });

  it('defaults to the neon theme when no override is present', () => {
    expect(DEFAULT_THEME_ID).toBe('vegas-neon');
    expect(getActiveTheme().id).toBe('vegas-neon');
  });
});
