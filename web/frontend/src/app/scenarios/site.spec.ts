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
 * Regression guard for the P0 Site Pack refactor. Asserts that the Las Vegas
 * site holds the EXACT constants that were inlined before the refactor, so the
 * scenario renders identically. If any of these change, the Vegas demo has
 * (silently) changed and this test must fail.
 */
import { describe, it, expect } from 'vitest';
import { VEGAS_SITE, getActiveSite, DEFAULT_SITE_ID } from './site';

describe('Vegas Site Pack (P0 render-parity guard)', () => {
  it('preserves the pre-refactor geographic anchor', () => {
    expect(VEGAS_SITE.mapCenter.lat).toBe(36.1085);
    expect(VEGAS_SITE.mapCenter.lon).toBe(-115.1769);
  });

  it('preserves the pre-refactor GLB path', () => {
    expect(VEGAS_SITE.glbPath).toBe('models/Google_LasVegas_Export_v32.glb');
  });

  it('preserves the pre-refactor GLB world transform', () => {
    expect(VEGAS_SITE.glbTransform).toEqual({
      scale: 0.1,
      offsetX: 40,
      offsetY: 0,
      offsetZ: -10,
      rotationY: 0,
    });
  });

  it('defaults to Vegas when no scenario override is present', () => {
    expect(DEFAULT_SITE_ID).toBe('vegas');
    expect(getActiveSite().id).toBe('vegas');
    expect(getActiveSite().name).toBe('Las Vegas');
  });
});
