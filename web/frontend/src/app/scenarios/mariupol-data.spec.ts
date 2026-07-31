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
 * Tests for the captured Mariupol source data. Guards that the transcribed
 * figures stay internally consistent (zone totals match the published exposed /
 * vulnerable population) and that cohort tags are unique and traceable.
 */
import { describe, it, expect } from 'vitest';
import { MARIUPOL_ZONES, MARIUPOL_FACTS, mariupolZoneTotals } from './mariupol-data';

describe('Mariupol captured data', () => {
  it('has five priority-ranked emergency zones', () => {
    expect(MARIUPOL_ZONES.length).toBe(5);
  });

  it('zone populations sum exactly to the published exposed population', () => {
    const totals = mariupolZoneTotals();
    expect(totals.population).toBe(MARIUPOL_FACTS.exposedPopulation);
    expect(totals.population).toBe(37663);
  });

  it('zone vulnerable counts sum exactly to the published vulnerable population', () => {
    const totals = mariupolZoneTotals();
    expect(totals.vulnerable).toBe(MARIUPOL_FACTS.vulnerablePopulation);
    expect(totals.vulnerable).toBe(16102);
  });

  it('each zone child/elderly/disabled split sums to its vulnerable total', () => {
    for (const z of MARIUPOL_ZONES) {
      expect(z.children + z.elderly + z.disabled).toBe(z.vulnerable);
    }
  });

  it('cohort tags are unique and traceable', () => {
    const tags = new Set(MARIUPOL_ZONES.map((z) => z.tag));
    expect(tags.size).toBe(MARIUPOL_ZONES.length);
    for (const z of MARIUPOL_ZONES) expect(z.tag).toBe(`mariupol-${z.id.toLowerCase()}`);
  });

  it('carries the captured scenario facts', () => {
    expect(MARIUPOL_FACTS.severity).toBeCloseTo(0.54);
    expect(MARIUPOL_FACTS.corridorKm).toBe(227);
    expect(MARIUPOL_FACTS.destinationName).toBe('Zaporizhzhia');
  });
});
