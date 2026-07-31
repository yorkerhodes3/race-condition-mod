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
 * Tests for the Scenario Copy Pack (P7). Vegas copy must be the identity so the
 * marathon wording is unchanged; Mariupol re-words to evacuation language.
 */
import { describe, it, expect } from 'vitest';
import {
  VEGAS_COPY,
  MARIUPOL_COPY,
  getActiveCopy,
  rewordWith,
  genericToolName,
} from './copy';

describe('Scenario Copy Pack (P7)', () => {
  it('keeps the Vegas marathon wording (identity)', () => {
    expect(VEGAS_COPY.participantPlural).toBe('runners');
    expect(VEGAS_COPY.hudTitle).toBe('Simulation progress');
    expect(VEGAS_COPY.finishersLabel).toBe('RACE FINISHERS');
    // reword is a no-op for Vegas.
    const s = 'Runner 12 and other runners crossed the finish line of the Marathon';
    expect(rewordWith(s, VEGAS_COPY)).toBe(s);
    expect(getActiveCopy().id).toBe('vegas'); // node/vitest has no window → default
  });

  it('re-words marathon text to evacuation language for Mariupol', () => {
    expect(MARIUPOL_COPY.participantPlural).toBe('evacuees');
    expect(MARIUPOL_COPY.hudTitle).toBe('Evacuation progress');
    expect(MARIUPOL_COPY.finishersLabel).toBe('EVACUEES SAFE');
    // The cached expected-participant count (10,000) maps to the real exposed
    // population, and "runners" → "evacuees".
    expect(rewordWith('10,000 runners', MARIUPOL_COPY)).toBe('37,663 evacuees');
    expect(rewordWith('Runner 12', MARIUPOL_COPY)).toBe('Evacuee 12');
    // Cached marathon card values map to captured Mariupol data (item 1).
    expect(rewordWith('Las Vegas Boulevard', MARIUPOL_COPY)).toBe(
      'Central Corridor · Zones 1–2 → Exit West',
    );
    expect(rewordWith('Total distance 26.2 miles', MARIUPOL_COPY)).toBe('Total distance 227 km');
    expect(rewordWith('They crossed the finish line!', MARIUPOL_COPY)).toBe(
      'They reached safety!',
    );
    expect(rewordWith('Plan a Marathon', MARIUPOL_COPY)).toBe('Plan a Evacuation');
  });

  it('makes the race-collector tool names generic (display only)', () => {
    expect(genericToolName('start_race_collector')).toBe('start_sim_collector');
    expect(genericToolName('stop_race_collector')).toBe('stop_sim_collector');
    expect(genericToolName('spawn_runners')).toBe('spawn_runners');
  });
});
