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
 * Mariupol source data (captured, real — retrospective / open-data).
 *
 * Figures transcribed from the Ethical-Tech-CoLab / Christine Lumen
 * `mariupol-evacuation-model` "Data-Driven Evacuation Analysis" (Late March–April
 * 2022 window) and the daily severity model for 16 March 2022. This is the
 * single source of truth for the Mariupol scenario's numbers so the HUD, cards,
 * and cohort agents all read the same captured values instead of marathon
 * placeholders.
 *
 * Provenance: population = OSM building centroids (45,544) via WorldPop
 * disaggregation; damage = UNITAR/UNOSAT CE20220223UKR; lights = NASA VIIRS
 * Black Marble; corridor/dates = OCHA/ICRC/OHCHR reporting. Retrospective,
 * non-operational (see docs/P7-MARIUPOL-PREP.md §5). Pure module: no three.js,
 * no DOM — safe to unit-test and to import anywhere.
 */

/** One emergency/origin zone cohort. Populations start from these locations. */
export interface MariupolZone {
  /** Short stable id / cohort tag, e.g. 'Z1'. */
  readonly id: string;
  /** Full cohort tag used to track agents, e.g. 'mariupol-z1'. */
  readonly tag: string;
  /** Display name. */
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  /** Estimated exposed population in the zone. */
  readonly population: number;
  /** Vulnerable subset (children + elderly + persons with disabilities). */
  readonly vulnerable: number;
  readonly children: number;
  readonly elderly: number;
  readonly disabled: number;
  /** Building count (OSM centroids) in the zone. */
  readonly buildings: number;
  /** % of structures damaged (UNOSAT). */
  readonly damagePct: number;
  /** % of area dark (VIIRS light loss). */
  readonly darkPct: number;
  /** Count of destroyed structures. */
  readonly destroyed: number;
}

/**
 * The five priority-ranked emergency zones. Population and vulnerable totals sum
 * exactly to MARIUPOL_FACTS.exposedPopulation / .vulnerablePopulation. Zone 5's
 * child/elderly/disabled split is estimated to its (exact) vulnerable total —
 * the source truncates that row; all other figures are as published.
 */
export const MARIUPOL_ZONES: readonly MariupolZone[] = [
  {
    id: 'Z1',
    tag: 'mariupol-z1',
    name: 'Zone 1 · Central',
    lon: 37.5432,
    lat: 47.0965,
    population: 6373,
    vulnerable: 2649,
    children: 1050,
    elderly: 1308,
    disabled: 291,
    buildings: 482,
    damagePct: 24,
    darkPct: 76,
    destroyed: 15,
  },
  {
    id: 'Z2',
    tag: 'mariupol-z2',
    name: 'Zone 2 · Central',
    lon: 37.5446,
    lat: 47.0985,
    population: 8386,
    vulnerable: 3606,
    children: 1342,
    elderly: 1845,
    disabled: 419,
    buildings: 599,
    damagePct: 0,
    darkPct: 78,
    destroyed: 0,
  },
  {
    id: 'Z3',
    tag: 'mariupol-z3',
    name: 'Zone 3 · Central',
    lon: 37.5419,
    lat: 47.0998,
    population: 7196,
    vulnerable: 3095,
    children: 1151,
    elderly: 1583,
    disabled: 361,
    buildings: 514,
    damagePct: 0,
    darkPct: 75,
    destroyed: 0,
  },
  {
    id: 'Z4',
    tag: 'mariupol-z4',
    name: 'Zone 4 · Central',
    lon: 37.5449,
    lat: 47.0928,
    population: 8806,
    vulnerable: 3784,
    children: 1408,
    elderly: 1936,
    disabled: 440,
    buildings: 629,
    damagePct: 2,
    darkPct: 75,
    destroyed: 3,
  },
  {
    id: 'Z5',
    tag: 'mariupol-z5',
    name: 'Zone 5 · Central',
    lon: 37.5417,
    lat: 47.0912,
    population: 6902,
    vulnerable: 2968,
    children: 1105, // estimated split (source row truncated)
    elderly: 1518, // estimated split
    disabled: 345, // estimated split
    buildings: 493,
    damagePct: 0,
    darkPct: 77,
    destroyed: 0,
  },
];

/** Scenario-wide captured facts for 16 March 2022 / the Late Mar–Apr window. */
export interface MariupolFacts {
  readonly assessmentDate: string;
  readonly severity: number;
  readonly phase: string;
  readonly encircledSince: string;
  readonly corridorRegime: string;
  readonly preSiegePopulation: number;
  readonly exposedPopulation: number;
  readonly vulnerablePopulation: number;
  readonly damagePct: number;
  readonly lightsPct: number;
  readonly unosatPoints: number;
  readonly buildingCount: number;
  readonly destinationName: string;
  /** Full corridor distance to safety (km). */
  readonly corridorKm: number;
  /** In-city Dijkstra route to the western exit (km). */
  readonly inCityRouteKm: number;
}

export const MARIUPOL_FACTS: MariupolFacts = {
  assessmentDate: '16 March 2022',
  severity: 0.54,
  phase: 'Phase 3 of 5 — Serious',
  encircledSince: '2 March 2022',
  corridorRegime: 'Self-evacuation (disputed)',
  preSiegePopulation: 343598,
  exposedPopulation: 37663,
  vulnerablePopulation: 16102,
  damagePct: 16,
  lightsPct: 22,
  unosatPoints: 783,
  buildingCount: 45544,
  destinationName: 'Zaporizhzhia',
  corridorKm: 227,
  inCityRouteKm: 7.0,
};

/** Derived totals across the zone cohorts (kept as a helper, not duplicated). */
export function mariupolZoneTotals(): {
  population: number;
  vulnerable: number;
  children: number;
  elderly: number;
  disabled: number;
  buildings: number;
} {
  return MARIUPOL_ZONES.reduce(
    (acc, z) => ({
      population: acc.population + z.population,
      vulnerable: acc.vulnerable + z.vulnerable,
      children: acc.children + z.children,
      elderly: acc.elderly + z.elderly,
      disabled: acc.disabled + z.disabled,
      buildings: acc.buildings + z.buildings,
    }),
    { population: 0, vulnerable: 0, children: 0, elderly: 0, disabled: 0, buildings: 0 },
  );
}
