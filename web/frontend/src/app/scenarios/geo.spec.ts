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
 * Tests for the pure geo data layer (P7 schematic sites): projection correctness
 * and defensive GeoJSON/building parsing.
 */
import { describe, it, expect } from 'vitest';
import { makeProjector, parseBuildings, parseCorridor, parsePois, parseDamage } from './geo';

const MARIUPOL = { lat: 47.0958, lon: 37.5497 };

describe('geo projection', () => {
  it('maps the anchor to the offset origin', () => {
    const p = makeProjector(MARIUPOL, 0.1, 40, -10);
    const at = p(MARIUPOL.lon, MARIUPOL.lat);
    expect(at.x).toBeCloseTo(40, 6);
    expect(at.z).toBeCloseTo(-10, 6);
  });

  it('places east as +x and north as -z', () => {
    const p = makeProjector(MARIUPOL, 0.1);
    const east = p(MARIUPOL.lon + 0.01, MARIUPOL.lat);
    const north = p(MARIUPOL.lon, MARIUPOL.lat + 0.01);
    expect(east.x).toBeGreaterThan(0);
    expect(east.z).toBeCloseTo(0, 6);
    expect(north.z).toBeLessThan(0);
    expect(north.x).toBeCloseTo(0, 6);
  });

  it('scales linearly with the scale factor', () => {
    const p1 = makeProjector(MARIUPOL, 0.1);
    const p2 = makeProjector(MARIUPOL, 0.2);
    const a = p1(MARIUPOL.lon + 0.02, MARIUPOL.lat);
    const b = p2(MARIUPOL.lon + 0.02, MARIUPOL.lat);
    expect(b.x).toBeCloseTo(a.x * 2, 6);
  });
});

describe('parseBuildings', () => {
  it('accepts {lon,lat,height} and {centroid} shapes and skips bad rows', () => {
    const rows = parseBuildings([
      { lon: 37.55, lat: 47.1, height: 24 },
      { centroid: [37.56, 47.11] },
      { lon: 'x', lat: 47 },
      null,
      42,
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ lon: 37.55, lat: 47.1, height: 24 });
    expect(rows[1].height).toBe(15); // default
  });

  it('accepts a { buildings: [...] } wrapper', () => {
    expect(parseBuildings({ buildings: [{ lon: 1, lat: 2 }] })).toHaveLength(1);
    expect(parseBuildings('nope')).toEqual([]);
  });

  it('accepts compact [lon,lat] / [lon,lat,height] tuples (vendored OSM pack)', () => {
    const rows = parseBuildings([
      [37.55, 47.1],
      [37.56, 47.11, 30],
      [37.57], // too short → skipped
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ lon: 37.55, lat: 47.1, height: 15 });
    expect(rows[1].height).toBe(30);
  });
});

describe('parseDamage', () => {
  it('parses [lon,lat,severity] tuples and defaults severity to 1', () => {
    const rows = parseDamage([
      [37.65, 47.12, 3],
      [37.66, 47.13],
      [37.6], // too short → skipped
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ lon: 37.65, lat: 47.12, severity: 3 });
    expect(rows[1].severity).toBe(1);
    expect(parseDamage('nope')).toEqual([]);
  });
});

describe('parseCorridor', () => {
  it('returns the first LineString coordinates as lon/lat', () => {
    const gj = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[37.55, 47.1], [37.5, 47.2], [37.4, 47.3]] },
          properties: {},
        },
      ],
    };
    const pts = parseCorridor(gj);
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ lon: 37.55, lat: 47.1 });
    expect(parseCorridor({})).toEqual([]);
  });
});

describe('parsePois', () => {
  it('parses Point features and resolves the type, defaulting to danger_zone', () => {
    const gj = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [37.55, 47.1] },
          properties: { poi_type: 'shelter', name: 'School 5' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [37.56, 47.11] },
          properties: {},
        },
      ],
    };
    const pois = parsePois(gj);
    expect(pois).toHaveLength(2);
    expect(pois[0]).toEqual({ type: 'shelter', lon: 37.55, lat: 47.1, name: 'School 5' });
    expect(pois[1].type).toBe('danger_zone');
  });
});
