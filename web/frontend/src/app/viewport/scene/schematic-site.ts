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
 * Schematic site renderer (P7). For a Site that has no city GLB but declares
 * data sources (see scenarios/site.ts `SiteData`), fetch and render a simple
 * schematic world: extruded building blocks, the evacuation corridor, and POI
 * markers (danger zones / shelters / assembly points). Coordinates are projected
 * with the shared anchor-relative math in scenarios/geo.ts.
 *
 * Isolated to the GLB-less path — the Vegas scenario never calls this. It is
 * defensive: any missing/failed data source is skipped, never fatal.
 */
import * as THREE from 'three';
import { Context } from '../context';
import { getActiveSite } from '../../scenarios/site';
import {
  makeProjector,
  parseBuildings,
  parseCorridor,
  parsePois,
  type Projector,
  type SitePoi,
  type Building,
  type GeoAnchor,
} from '../../scenarios/geo';

/** Marker color per POI type; unknown types fall back to gray. */
const POI_COLORS: Record<string, number> = {
  danger_zone: 0xc0392b,
  shelter: 0x2ecc71,
  assembly_point: 0xf2c200,
  checkpoint: 0x4d96ff,
  triage: 0xff8c42,
  aid_station: 0x35e0c8,
  supply: 0x9b59b6,
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/**
 * Build the schematic world for the active site if it is GLB-less and has data.
 * Safe to await from initModel; resolves quietly when there is nothing to do.
 */
export async function buildSchematicSite(ctx: Context): Promise<void> {
  const site = getActiveSite();
  if (!site.data) return;
  const t = site.glbTransform;
  const project = makeProjector(site.mapCenter, t.scale, t.offsetX, t.offsetZ);
  const scale = t.scale;
  addGround(ctx);
  let bounds: Bounds | null = null;

  if (site.data.buildingsUrl) {
    try {
      const buildings = parseBuildings(await fetchJson(site.data.buildingsUrl));
      if (buildings.length) {
        addBuildings(ctx, buildings, project, scale);
        bounds = boundsOf(buildings, project);
      }
    } catch (err) {
      console.warn('[schematic-site] buildings failed', err);
    }
  }

  if (site.data.routeUrl) {
    try {
      const corridor = parseCorridor(await fetchJson(site.data.routeUrl));
      if (corridor.length >= 2) addCorridor(ctx, corridor, project);
    } catch (err) {
      console.warn('[schematic-site] corridor failed', err);
    }
  }

  if (site.data.poisUrl) {
    try {
      const pois = parsePois(await fetchJson(site.data.poisUrl));
      if (pois.length) addPois(ctx, pois, project, scale);
    } catch (err) {
      console.warn('[schematic-site] POIs failed', err);
    }
  }

  // Point the camera at the city so the schematic is actually in frame (there is
  // no city GLB or demo camera to do it). If a demo later runs, it takes over.
  if (bounds) frameSchematic(ctx, bounds);
}

interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function boundsOf(buildings: Building[], project: Projector): Bounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const b of buildings) {
    const { x, z } = project(b.lon, b.lat);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

function frameSchematic(ctx: Context, b: Bounds): void {
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 40);
  const r = span * 0.85;
  ctx.cameraFollow = null;
  ctx.camera.position.set(cx + r * 0.9, r * 1.1, cz + r * 0.9);
  ctx.camera.lookAt(cx, 0, cz);
  if (ctx.controls) {
    ctx.controls.target.set(cx, 0, cz);
    ctx.controls.update();
  }
}

function addGround(ctx: Context): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20000, 20000),
    new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 1, metalness: 0 }),
  );
  ground.name = 'schematic-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  ctx.scene.add(ground);
}

function addBuildings(
  ctx: Context,
  buildings: Building[],
  project: Projector,
  scale: number,
): void {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x5b6470,
    emissive: 0x171b21,
    emissiveIntensity: 1,
    roughness: 0.9,
    metalness: 0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, buildings.length);
  mesh.name = 'schematic-buildings';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const footprint = Math.max(0.5, 12 * scale);
  const m = new THREE.Matrix4();
  buildings.forEach((b, i) => {
    const { x, z } = project(b.lon, b.lat);
    const h = Math.max(0.5, b.height * scale);
    m.makeScale(footprint, h, footprint);
    m.setPosition(x, h / 2, z);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  ctx.scene.add(mesh);
}

function addCorridor(ctx: Context, corridor: GeoAnchor[], project: Projector): void {
  const pts = corridor.map((p) => {
    const { x, z } = project(p.lon, p.lat);
    return new THREE.Vector3(x, 0.6, z);
  });
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(16, pts.length * 8), 3, 6, false),
    new THREE.MeshStandardMaterial({
      color: 0xf2c200,
      emissive: 0xf2c200,
      emissiveIntensity: 0.5,
    }),
  );
  tube.name = 'schematic-corridor';
  ctx.scene.add(tube);
}

function addPois(ctx: Context, pois: SitePoi[], project: Projector, scale: number): void {
  const group = new THREE.Group();
  group.name = 'schematic-pois';
  for (const p of pois) {
    const { x, z } = project(p.lon, p.lat);
    const color = POI_COLORS[p.type] ?? 0x888888;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.85,
    });
    const r = Math.max(4, (p.radius ?? 60) * scale * 0.5);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.5, 20), mat);
    disc.position.set(x, 0.9, z);
    group.add(disc);
    // A vertical pin so a marker is legible from the fly cameras.
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 30, 6),
      mat.clone() as THREE.Material,
    );
    pin.position.set(x, 15, z);
    group.add(pin);
  }
  ctx.scene.add(group);
}
