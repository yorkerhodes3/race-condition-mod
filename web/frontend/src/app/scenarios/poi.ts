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
 * POI (point-of-interest) taxonomy.
 *
 * The Las Vegas marathon uses four station types. This module makes that set
 * the single, canonical source of truth and reserves an additive set of
 * evacuation POI types for the location-swappable twin (see
 * docs/DESIGN-CHANGES-SITE-Purpose.md §4.3). The evacuation types are declared
 * but never instantiated for the Vegas site, so Vegas renders identically.
 *
 * This module is pure: no three.js, no DOM. It is safe to import from both the
 * browser bundle and the node/vitest parity guards.
 */

/**
 * The four station types that drive the Las Vegas marathon render. Order is
 * significant for the parity guard and must not change.
 */
export const BASE_POI_TYPES = [
  'water_station',
  'medical_tent',
  'crowd_zone',
  'portable_toilet',
] as const;

/**
 * Evacuation POI types reserved for non-Vegas sites. Additive only: never
 * instantiated for the Vegas site, so they have no effect on the Vegas render.
 */
export const EVAC_POI_TYPES = [
  'shelter',
  'danger_zone',
  'assembly_point',
  'triage',
  'checkpoint',
  'aid_station',
  'supply',
] as const;

export type BasePoiType = (typeof BASE_POI_TYPES)[number];
export type EvacPoiType = (typeof EVAC_POI_TYPES)[number];

/** The full POI taxonomy: the four Vegas station types plus evacuation types. */
export type PoiType = BasePoiType | EvacPoiType;

/** All known POI type identifiers (base + evacuation). */
export const POI_TYPES = [...BASE_POI_TYPES, ...EVAC_POI_TYPES] as const;

/** True when `type` is one of the four Vegas station types. */
export function isBasePoiType(type: string): type is BasePoiType {
  return (BASE_POI_TYPES as readonly string[]).includes(type);
}
