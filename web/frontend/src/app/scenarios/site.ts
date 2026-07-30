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
 * Site Pack — the location-specific data for one scenario's 3D world.
 *
 * This module is the single source of truth for everything that used to be a
 * hardcoded "Las Vegas" constant (the geographic anchor, the city GLB path, and
 * its world-space transform). It is intentionally dependency-free (no three.js,
 * no DOM at import time) so it can be unit-tested in isolation and so importing
 * it never drags heavy WebGL code into a test.
 *
 * P0 goal: introduce this seam WITHOUT changing behavior. Only the Las Vegas
 * site is registered, and it holds the exact pre-refactor constants, so every
 * consumer that now reads from `getActiveSite()` renders identically.
 *
 * See docs/DESIGN-CHANGES-SITE-Purpose.md §4.1.
 */

/** A geographic anchor: the lat/lon that maps to the origin of the 3D world. */
export interface GeoAnchor {
  lat: number;
  lon: number;
}

/**
 * Placement of the city GLB mesh in world space. Structurally identical to
 * `GLBRoadsTransform` in ../glb-roads so the two are assignable.
 */
export interface SiteGlbTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotationY: number;
}

/** A Site Pack: everything location-specific about one scenario's world. */
export interface Site {
  /** Stable scenario id, e.g. "vegas". Selected via window.ENV.SCENARIO. */
  id: string;
  /** Human-readable name for labels/copy. */
  name: string;
  /** Lat/lon placed at the world origin; drives the Mercator projection. */
  mapCenter: GeoAnchor;
  /**
   * City GLB path, relative to the GLTF loader's `assets/` base path. Optional:
   * a schematic site (no photogrammetry mesh) omits it and renders without a
   * city mesh (see viewport/scene/scene.ts initModel).
   */
  glbPath?: string;
  /** World-space transform applied to the loaded city/roads mesh. */
  glbTransform: SiteGlbTransform;
}

/**
 * Las Vegas — the original scenario. These values are the exact constants that
 * previously lived inline in viewport/config.ts, glb-roads.ts, road-network.ts,
 * and viewport/scene/scene.ts. Do not "clean up" the numbers: parity with the
 * pre-refactor render depends on them being byte-for-byte identical (guarded by
 * site.spec.ts).
 */
export const VEGAS_SITE: Site = {
  id: 'vegas',
  name: 'Las Vegas',
  mapCenter: { lat: 36.1085, lon: -115.1769 },
  glbPath: 'models/Google_LasVegas_Export_v32.glb',
  glbTransform: { scale: 0.1, offsetX: 40, offsetY: 0, offsetZ: -10, rotationY: 0 },
};

/**
 * Mariupol — the evacuation twin's second site (P7). Anchored on the city center
 * (ETC mariupol-evacuation-model uses 47.10°N, 37.55°E; see
 * docs/P7-MARIUPOL-PREP.md). `glbPath` is intentionally omitted until an
 * OSM-extruded city mesh is produced and its source data licensing is cleared,
 * so the scenario renders schematically for now. Opt-in via `?scenario=mariupol`;
 * it is never the default, and Vegas is unaffected.
 */
export const MARIUPOL_SITE: Site = {
  id: 'mariupol',
  name: 'Mariupol',
  mapCenter: { lat: 47.0958, lon: 37.5497 },
  glbTransform: { scale: 1, offsetX: 0, offsetY: 0, offsetZ: 0, rotationY: 0 },
};

/** Registry of known sites. Additional scenarios register here in later phases. */
export const SITES: Record<string, Site> = {
  [VEGAS_SITE.id]: VEGAS_SITE,
  [MARIUPOL_SITE.id]: MARIUPOL_SITE,
};

/** Fallback scenario when nothing is selected or an unknown id is requested. */
export const DEFAULT_SITE_ID = 'vegas';

/**
 * Resolve the active scenario id from (in priority order) the `?scenario=`
 * query param, then `window.ENV.SCENARIO`, then the default. Never throws and
 * is safe to call outside a browser (e.g. under vitest / node).
 */
function resolveSiteId(): string {
  let fromQuery = '';
  let fromEnv = '';
  try {
    if (typeof window !== 'undefined' && window.location) {
      fromQuery = new URLSearchParams(window.location.search).get('scenario') ?? '';
    }
  } catch {
    /* not in a browser; ignore */
  }
  try {
    const env = (globalThis as unknown as { ENV?: { SCENARIO?: string } }).ENV;
    if (env && typeof env.SCENARIO === 'string') {
      fromEnv = env.SCENARIO;
    }
  } catch {
    /* no runtime env; ignore */
  }
  const id = (fromQuery || fromEnv || '').trim().toLowerCase();
  return id && SITES[id] ? id : DEFAULT_SITE_ID;
}

let _activeSite: Site | null = null;

/**
 * The active Site Pack for this session. Resolved once and cached so every
 * consumer sees a single, stable site object (preserving the reference identity
 * that the old module-level constants had).
 */
export function getActiveSite(): Site {
  if (!_activeSite) {
    _activeSite = SITES[resolveSiteId()] ?? VEGAS_SITE;
  }
  return _activeSite;
}
