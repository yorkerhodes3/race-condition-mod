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
 * Fidelity guard for the city case-study scenarios: every registered city in
 * CITY_SCENARIOS must have a pack (`public/scenarios/<id>/`) whose zones/exits/
 * demographics match its declared targets (5 zones, 2 exits, 12,000 people,
 * internally-consistent vulnerable split, real buildings present).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CITY_SCENARIOS, CITY_POPULATION_TARGET } from './city-scenarios';

interface ZoneProps {
  poi_type: string;
  tag?: string;
  population?: number;
  vulnerable?: number;
  children?: number;
  elderly?: number;
  disabled?: number;
}
interface Feature {
  properties: ZoneProps;
}

function readJson<T>(rel: string): T {
  const url = new URL(`../../../public/scenarios/${rel}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as T;
}

describe('City case-study scenarios', () => {
  for (const city of Object.values(CITY_SCENARIOS)) {
    describe(city.name, () => {
      const pois = readJson<{ features: Feature[] }>(`${city.id}/pois.geojson`);
      const zones = pois.features.filter((f) => f.properties.poi_type === 'origin_zone');
      const exits = pois.features.filter((f) => f.properties.poi_type === 'exit');

      it(`has ${city.zones} origin zones`, () => {
        expect(zones.length).toBe(city.zones);
      });

      it(`has ${city.exits} exits`, () => {
        expect(exits.length).toBe(city.exits);
      });

      it(`zone population sums to ${city.populationTarget}`, () => {
        const sum = zones.reduce((a, z) => a + (z.properties.population ?? 0), 0);
        expect(sum).toBe(city.populationTarget);
        expect(sum).toBe(CITY_POPULATION_TARGET);
      });

      it('each zone child/elderly/disabled sums to its vulnerable total', () => {
        for (const z of zones) {
          const p = z.properties;
          expect((p.children ?? 0) + (p.elderly ?? 0) + (p.disabled ?? 0)).toBe(p.vulnerable ?? 0);
        }
      });

      it('zone tags are unique and namespaced by city id', () => {
        const tags = zones.map((z) => z.properties.tag ?? '');
        expect(new Set(tags).size).toBe(zones.length);
        for (const tag of tags) expect(tag.startsWith(`${city.id}-`)).toBe(true);
      });

      it('has real buildings vendored', () => {
        const buildings = readJson<unknown[]>(`${city.id}/buildings.json`);
        expect(Array.isArray(buildings)).toBe(true);
        expect(buildings.length).toBeGreaterThan(100);
      });

      it('declares a corridor route', () => {
        const route = readJson<{ features: { geometry: { type: string } }[] }>(
          `${city.id}/route.geojson`,
        );
        expect(route.features.some((f) => f.geometry.type === 'LineString')).toBe(true);
      });
    });
  }
});
