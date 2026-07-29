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
 * Regression guard for the P2 POI taxonomy refactor. Asserts the four Vegas
 * station types remain the canonical base set (unchanged and in order), so the
 * Vegas render is unaffected by the additive evacuation types.
 */
import { describe, it, expect } from 'vitest';
import {
  BASE_POI_TYPES,
  EVAC_POI_TYPES,
  POI_TYPES,
  isBasePoiType,
} from './poi';

describe('POI taxonomy (P2 render-parity guard)', () => {
  it('keeps the four Vegas station types unchanged and in order', () => {
    expect(BASE_POI_TYPES).toEqual([
      'water_station',
      'medical_tent',
      'crowd_zone',
      'portable_toilet',
    ]);
  });

  it('recognizes only the base four as base POI types', () => {
    for (const t of BASE_POI_TYPES) {
      expect(isBasePoiType(t)).toBe(true);
    }
    for (const t of EVAC_POI_TYPES) {
      expect(isBasePoiType(t)).toBe(false);
    }
  });

  it('composes the full taxonomy as base + evacuation with no overlap', () => {
    expect(POI_TYPES).toEqual([...BASE_POI_TYPES, ...EVAC_POI_TYPES]);
    const unique = new Set(POI_TYPES);
    expect(unique.size).toBe(POI_TYPES.length);
  });
});
