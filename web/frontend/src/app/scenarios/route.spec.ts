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
 * Regression guard for the P3 Route Pack refactor. Asserts the Vegas marathon
 * route holds the EXACT pre-refactor semantics — most importantly the course
 * distance that drives progress integration — so the simulation is unaffected.
 */
import { describe, it, expect } from 'vitest';
import {
  VEGAS_MARATHON_ROUTE,
  getActiveRoute,
  DEFAULT_ROUTE_ID,
} from './route';

describe('Vegas marathon Route Pack (P3 render/sim-parity guard)', () => {
  it('preserves the exact pre-refactor course distance', () => {
    expect(VEGAS_MARATHON_ROUTE.distanceMi).toBe(26.2188);
  });

  it('keeps the marathon single-loop semantics', () => {
    expect(VEGAS_MARATHON_ROUTE.routeType).toBe('marathon');
    expect(VEGAS_MARATHON_ROUTE.role).toBe('loop');
    expect(VEGAS_MARATHON_ROUTE.closedLoop).toBe(true);
  });

  it('defaults to the Vegas marathon route with the same distance', () => {
    expect(DEFAULT_ROUTE_ID).toBe('vegas-marathon');
    expect(getActiveRoute().id).toBe('vegas-marathon');
    expect(getActiveRoute().distanceMi).toBe(26.2188);
  });
});
