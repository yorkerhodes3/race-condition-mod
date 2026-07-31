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
  // Corridor/zone model (schematic evacuation twin, see docs/P7-MARIUPOL-PREP.md).
  origin_zone: 0xff5c72,
  exit: 0x35e08a,
  destination: 0x35e0c8,
  filtration: 0xb06be0,
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
  addSchematicLights(ctx);
  const bounds = emptyBounds();

  if (site.data.buildingsUrl) {
    try {
      const buildings = parseBuildings(await fetchJson(site.data.buildingsUrl));
      if (buildings.length) {
        addBuildings(ctx, buildings, project, scale);
        for (const b of buildings) growBounds(bounds, project(b.lon, b.lat));
      }
    } catch (err) {
      console.warn('[schematic-site] buildings failed', err);
    }
  }

  if (site.data.routeUrl) {
    try {
      const corridor = parseCorridor(await fetchJson(site.data.routeUrl));
      if (corridor.length >= 2) {
        addCorridor(ctx, corridor, project);
        for (const p of corridor) growBounds(bounds, project(p.lon, p.lat));
      }
    } catch (err) {
      console.warn('[schematic-site] corridor failed', err);
    }
  }

  if (site.data.poisUrl) {
    try {
      const pois = parsePois(await fetchJson(site.data.poisUrl));
      if (pois.length) {
        addPois(ctx, pois, project, scale);
        for (const p of pois) growBounds(bounds, project(p.lon, p.lat));
      }
    } catch (err) {
      console.warn('[schematic-site] POIs failed', err);
    }
  }

  // Point the camera at the whole model (city + corridor + zones) so it is
  // actually in frame — there is no city GLB or demo camera to do it. If a demo
  // later runs, it takes over.
  if (bounds.valid) frameSchematic(ctx, bounds);
}

interface Bounds {
  valid: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function emptyBounds(): Bounds {
  return { valid: false, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
}

function growBounds(b: Bounds, p: { x: number; z: number }): void {
  b.valid = true;
  if (p.x < b.minX) b.minX = p.x;
  if (p.x > b.maxX) b.maxX = p.x;
  if (p.z < b.minZ) b.minZ = p.z;
  if (p.z > b.maxZ) b.maxZ = p.z;
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

/**
 * Fill lighting for the schematic. The main scene lights are tuned for the Vegas
 * night render; a GLB-less schematic reads as too dark, so add a hemisphere fill
 * (sky/ground bounce) and a soft key so buildings, corridor and zones are
 * legible. Schematic-only — the Vegas path never calls this.
 */
function addSchematicLights(ctx: Context): void {
  const hemi = new THREE.HemisphereLight(0xcfe0f2, 0x3a4450, 2.2);
  hemi.name = 'schematic-hemi';
  ctx.scene.add(hemi);

  const fill = new THREE.DirectionalLight(0xffffff, 1.4);
  fill.name = 'schematic-fill';
  fill.position.set(600, 1200, 600);
  ctx.scene.add(fill);
}

function addGround(ctx: Context): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20000, 20000),
    new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 1, metalness: 0 }),
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
    color: 0x9aa6b4,
    emissive: 0x2c3644,
    emissiveIntensity: 0.6,
    roughness: 0.85,
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

  // Locate the western exit so origin zones can be shown converging on it
  // (the "multiple origins → EXIT WEST" model), and size the encirclement ring.
  const exit = pois.find((p) => p.type === 'exit');
  const exitPos = exit ? project(exit.lon, exit.lat) : null;
  const origins = pois.filter((p) => p.type === 'origin_zone');

  for (const p of pois) {
    const { x, z } = project(p.lon, p.lat);
    const color = POI_COLORS[p.type] ?? 0x888888;
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.6,
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
    // Text label above named nodes (city, exit, destination, zones, filtration).
    if (p.name) group.add(makeLabel(p.name, color, x, 34, z));
  }

  // Convergence: thin routes from each origin zone to the western exit.
  if (exitPos) {
    for (const o of origins) {
      const a = project(o.lon, o.lat);
      addConvergenceLine(group, a, exitPos);
    }
  }

  // Encirclement ring around the city (origins) — coloured/scaled like the
  // corridor-geography figure's severity ring. Drawn around the origin cluster.
  if (origins.length) {
    let cx = 0;
    let cz = 0;
    for (const o of origins) {
      const w = project(o.lon, o.lat);
      cx += w.x;
      cz += w.z;
    }
    cx /= origins.length;
    cz /= origins.length;
    let ringR = 30;
    for (const o of origins) {
      const w = project(o.lon, o.lat);
      ringR = Math.max(ringR, Math.hypot(w.x - cx, w.z - cz));
    }
    addEncirclement(group, cx, cz, ringR * 1.35);
  }

  ctx.scene.add(group);
}

/** A dashed-look convergence line from an origin zone to the western exit. */
function addConvergenceLine(
  group: THREE.Group,
  a: { x: number; z: number },
  b: { x: number; z: number },
): void {
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(a.x, 1.2, a.z),
    new THREE.Vector3(b.x, 1.2, b.z),
  ]);
  const line = new THREE.Line(
    geom,
    new THREE.LineBasicMaterial({ color: 0x35e08a, transparent: true, opacity: 0.7 }),
  );
  line.name = 'schematic-convergence';
  group.add(line);
}

/** A flat severity ring around the encircled city. */
function addEncirclement(group: THREE.Group, cx: number, cz: number, radius: number): void {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.97, radius, 96),
    new THREE.MeshBasicMaterial({
      color: 0xf2a900,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    }),
  );
  ring.name = 'schematic-encirclement';
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, 0.4, cz);
  group.add(ring);
}

/**
 * A camera-facing text label rendered from a canvas texture, positioned in world
 * space above a marker. Kept small and dependency-free (no font loading).
 */
function makeLabel(
  text: string,
  color: number,
  x: number,
  y: number,
  z: number,
): THREE.Sprite {
  const pad = 8;
  const font = 22;
  const canvas = document.createElement('canvas');
  const cctx = canvas.getContext('2d')!;
  cctx.font = `600 ${font}px system-ui, sans-serif`;
  const w = Math.ceil(cctx.measureText(text).width) + pad * 2;
  const h = font + pad * 2;
  canvas.width = w;
  canvas.height = h;
  cctx.font = `600 ${font}px system-ui, sans-serif`;
  cctx.fillStyle = 'rgba(8,12,18,0.72)';
  cctx.fillRect(0, 0, w, h);
  cctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  cctx.textBaseline = 'middle';
  cctx.fillText(text, pad, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  const worldH = 12;
  sprite.scale.set((w / h) * worldH, worldH, 1);
  sprite.position.set(x, y, z);
  sprite.renderOrder = 999;
  return sprite;
}

