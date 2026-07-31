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
 * City case-study scenarios (Venice / Paris / Barcelona / NYC).
 *
 * These are **modelling exercises**: real OSM building geometry (high fidelity)
 * with a representative evacuation model on top — five origin population zones,
 * two exits, and a target population of 12,000 moved under a family-cohesion
 * movement profile. They exist so we can compare "best case" data availability
 * against the harder Mariupol case. Not operational; the zone placements,
 * routes, and per-zone demographics are illustrative (see `fidelity`).
 *
 * This module is the source of truth for each city's *targets* and provenance;
 * the rendered pack data lives in `public/scenarios/<id>/` and is guarded
 * against these targets by `city-scenarios.spec.ts`.
 */

export interface CityScenario {
  /** Site id (matches `?scenario=`). */
  readonly id: string;
  readonly name: string;
  readonly country: string;
  /** District the OSM buildings were sampled from. */
  readonly district: string;
  readonly anchor: { lat: number; lon: number };
  /** People to move in the exercise. */
  readonly populationTarget: number;
  readonly zones: number;
  readonly exits: number;
  /**
   * Family-cohesion factor 0..1 (higher = households move together more tightly,
   * a movement constraint). Illustrative, tuned per city density/structure.
   */
  readonly cohesion: number;
  /** Average household size used to derive the cohesion movement constraint. */
  readonly avgHouseholdSize: number;
  /** Real building count vendored from OSM. */
  readonly buildingCount: number;
  /** Provenance of the geometry. */
  readonly buildingSource: string;
  /** Confidence notes (what is real vs. illustrative). */
  readonly fidelity: string;
}

export const CITY_SCENARIOS: Readonly<Record<string, CityScenario>> = {
  paris: {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    district: 'Marais · Île de la Cité · Bastille',
    anchor: { lat: 48.857, lon: 2.353 },
    populationTarget: 12000,
    zones: 5,
    exits: 2,
    cohesion: 0.78,
    avgHouseholdSize: 2.1,
    buildingCount: 3842,
    buildingSource:
      'OpenStreetMap building footprints (Overpass API, way["building"] centroids), © OpenStreetMap contributors (ODbL).',
    fidelity:
      'HIGH for building geometry (real OSM footprints). ILLUSTRATIVE for zones/exits (placed at real named neighbourhoods but not surveyed), routes (representative corridor, not a routed street path), and demographics (synthetic 12,000-person split, ~40% vulnerable).',
  },
  barcelona: {
    id: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    district: 'Ciutat Vella (Gòtic · Born · Raval) · Eixample edge',
    anchor: { lat: 41.389, lon: 2.173 },
    populationTarget: 12000,
    zones: 5,
    exits: 2,
    cohesion: 0.8,
    avgHouseholdSize: 2.5,
    buildingCount: 4243,
    buildingSource:
      'OpenStreetMap building footprints (Overpass API, way["building"] centroids), © OpenStreetMap contributors (ODbL).',
    fidelity:
      'HIGH for building geometry (real OSM footprints). ILLUSTRATIVE for zones/exits (real named neighbourhoods, not surveyed), routes (representative corridor), and demographics (synthetic 12,000-person split, ~40% vulnerable).',
  },
  venice: {
    id: 'venice',
    name: 'Venice',
    country: 'Italy',
    district: 'Central islands (San Marco · Rialto · Cannaregio · Dorsoduro · Castello)',
    anchor: { lat: 45.4364, lon: 12.3332 },
    populationTarget: 12000,
    zones: 5,
    exits: 2,
    cohesion: 0.82,
    avgHouseholdSize: 2.2,
    buildingCount: 4438,
    buildingSource:
      'OpenStreetMap building footprints (Overpass API, way["building"] centroids), © OpenStreetMap contributors (ODbL).',
    fidelity:
      'HIGH for building geometry (real OSM footprints). ILLUSTRATIVE for zones (real sestieri, not surveyed) and demographics (synthetic 12,000-person split, ~40% vulnerable). Exits are placed at the REAL land-egress points (Piazzale Roma causeway, Santa Lucia rail station); corridor is a representative pedestrian line, not a routed calle path.',
  },
};

/** Total population across a city's zones must equal this. */
export const CITY_POPULATION_TARGET = 12000;
