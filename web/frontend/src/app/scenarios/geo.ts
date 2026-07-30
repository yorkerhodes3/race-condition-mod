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
 * Geo data layer for schematic Site Packs (P7).
 *
 * Pure, dependency-free helpers (no three.js, no DOM) that (a) project lon/lat
 * to the world XZ plane using the same anchor-relative Web-Mercator math as the
 * Vegas road/icon systems, and (b) parse a site's building / corridor / POI data
 * defensively (never throw; ignore malformed input). The schematic renderer
 * (viewport/scene/schematic-site.ts) consumes these; the real ETC Mariupol data
 * drops into the same shapes.
 */

/** WGS84 equatorial radius (meters) — matches road-network.ts / icons.ts. */
const R_EARTH = 6378137;

export interface GeoAnchor {
  lat: number;
  lon: number;
}

export interface WorldXZ {
  x: number;
  z: number;
}

/** Projects (lon, lat) to world XZ. */
export type Projector = (lon: number, lat: number) => WorldXZ;

/**
 * Build an anchor-relative Web-Mercator projector. `scale` maps meters→world
 * units (e.g. a site's `glbTransform.scale`); `offsetX`/`offsetZ` shift the
 * origin. Matches `lonLatToWorld` in road-network.ts (x east, z south-negated).
 */
export function makeProjector(
  anchor: GeoAnchor,
  scale: number,
  offsetX = 0,
  offsetZ = 0,
): Projector {
  const cx = ((anchor.lon * Math.PI) / 180) * R_EARTH;
  const cy = Math.log(Math.tan(Math.PI / 4 + (anchor.lat * Math.PI) / 180 / 2)) * R_EARTH;
  return (lon: number, lat: number): WorldXZ => {
    const mx = ((lon * Math.PI) / 180) * R_EARTH;
    const my = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 180 / 2)) * R_EARTH;
    return {
      x: (mx - cx) * scale + offsetX,
      z: -((my - cy) * scale) + offsetZ,
    };
  };
}

// ── Building footprints ──────────────────────────────────────────────────────

export interface Building {
  lon: number;
  lat: number;
  /** Height in meters (before world scaling). */
  height: number;
}

/** True when `v` is a finite number. */
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Parse a buildings array. Accepts either `{ lon, lat, height? }` objects or a
 * `{ centroid: [lon, lat], height? }` shape (OSM centroid style). Unknown/short
 * entries are skipped. Default height 15m.
 */
export function parseBuildings(json: unknown): Building[] {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as { buildings?: unknown[] }).buildings)
      ? (json as { buildings: unknown[] }).buildings
      : [];
  const out: Building[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    let lon: unknown = o['lon'];
    let lat: unknown = o['lat'];
    if (!isNum(lon) || !isNum(lat)) {
      const c = o['centroid'];
      if (Array.isArray(c) && c.length >= 2) {
        lon = c[0];
        lat = c[1];
      }
    }
    if (!isNum(lon) || !isNum(lat)) continue;
    const h = isNum(o['height']) ? (o['height'] as number) : 15;
    out.push({ lon, lat, height: Math.max(1, h) });
  }
  return out;
}

// ── Corridor (route LineString) ──────────────────────────────────────────────

/** Parse the first LineString in a GeoJSON FeatureCollection into lon/lat pairs. */
export function parseCorridor(geojson: unknown): GeoAnchor[] {
  const features = featuresOf(geojson);
  for (const f of features) {
    const geom = (f as Record<string, unknown>)['geometry'];
    if (!geom || typeof geom !== 'object') continue;
    const g = geom as Record<string, unknown>;
    if (g['type'] !== 'LineString' || !Array.isArray(g['coordinates'])) continue;
    const pts: GeoAnchor[] = [];
    for (const c of g['coordinates'] as unknown[]) {
      if (Array.isArray(c) && isNum(c[0]) && isNum(c[1])) {
        pts.push({ lon: c[0] as number, lat: c[1] as number });
      }
    }
    if (pts.length >= 2) return pts;
  }
  return [];
}

// ── POIs (danger zones / shelters / assembly points) ─────────────────────────

export interface SitePoi {
  /** e.g. 'danger_zone' | 'shelter' | 'assembly_point' | 'checkpoint'. */
  type: string;
  lon: number;
  lat: number;
  name?: string;
  /** Optional influence radius in meters (danger zones). */
  radius?: number;
}

/** Parse GeoJSON Point features into typed POIs. */
export function parsePois(geojson: unknown): SitePoi[] {
  const out: SitePoi[] = [];
  for (const f of featuresOf(geojson)) {
    const feat = f as Record<string, unknown>;
    const geom = feat['geometry'];
    const props = (feat['properties'] as Record<string, unknown>) ?? {};
    if (!geom || typeof geom !== 'object') continue;
    const g = geom as Record<string, unknown>;
    if (g['type'] !== 'Point' || !Array.isArray(g['coordinates'])) continue;
    const [lon, lat] = g['coordinates'] as unknown[];
    if (!isNum(lon) || !isNum(lat)) continue;
    const type =
      (typeof props['poi_type'] === 'string' && props['poi_type']) ||
      (typeof props['marker-type'] === 'string' && props['marker-type']) ||
      'danger_zone';
    const poi: SitePoi = { type: type as string, lon: lon as number, lat: lat as number };
    if (typeof props['name'] === 'string') poi.name = props['name'];
    if (isNum(props['radius'])) poi.radius = props['radius'] as number;
    out.push(poi);
  }
  return out;
}

function featuresOf(geojson: unknown): unknown[] {
  if (!geojson || typeof geojson !== 'object') return [];
  const g = geojson as Record<string, unknown>;
  if (Array.isArray(g['features'])) return g['features'];
  if (g['type'] === 'Feature') return [geojson];
  return [];
}
