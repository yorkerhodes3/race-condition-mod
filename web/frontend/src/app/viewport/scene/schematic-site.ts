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

/** Per-cohort zone colours (index-aligned to the origin zones, Z1..Zn). */
const ZONE_COLORS: number[] = [0xff5c72, 0x4d96ff, 0xf2c200, 0x35e0c8, 0xb06be0, 0xff8c42];

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
  let corridor: GeoAnchor[] = [];
  let pois: SitePoi[] = [];

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
      corridor = parseCorridor(await fetchJson(site.data.routeUrl));
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
      pois = parsePois(await fetchJson(site.data.poisUrl));
      if (pois.length) {
        addPois(ctx, pois, project, scale);
        for (const p of pois) growBounds(bounds, project(p.lon, p.lat));
      }
    } catch (err) {
      console.warn('[schematic-site] POIs failed', err);
    }
  }

  // Animate evacuees flowing from the origin zones to the western exit and out
  // along the corridor — the same "people on the route" read as the Vegas race.
  addEvacuees(ctx, pois, corridor, project);

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
  // Publish the focus so the intro and Cam A/B/C frame the schematic instead of
  // the (Las Vegas-scale) defaults. Kept at ground level (y = 0).
  ctx.schematicFocus = { center: new THREE.Vector3(cx, 0, cz), radius: r };
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
  // Read as city blocks (not dots): wider footprint and exaggerated height so
  // the skyline is legible at the framed camera distance.
  const footprint = Math.max(3.5, 45 * scale);
  const m = new THREE.Matrix4();
  buildings.forEach((b, i) => {
    const { x, z } = project(b.lon, b.lat);
    const h = Math.max(3, b.height * scale * 4);
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
    return new THREE.Vector3(x, 0.8, z);
  });
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(24, pts.length * 10), 1.4, 8, false),
    new THREE.MeshStandardMaterial({
      color: 0xf2c200,
      emissive: 0xf2c200,
      emissiveIntensity: 0.8,
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

  let zoneIdx = 0;
  for (const p of pois) {
    const { x, z } = project(p.lon, p.lat);
    const isZone = p.type === 'origin_zone';
    // Each origin-zone cohort gets its own colour so it is traceable end-to-end
    // (marker + convergence + evacuee agents all share the zone colour).
    const color = isZone
      ? ZONE_COLORS[zoneIdx % ZONE_COLORS.length]
      : POI_COLORS[p.type] ?? 0x888888;
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
    // A vertical pin so a marker is legible from the fly cameras. Zone pins are
    // taller so their (staggered) labels clear the cluster.
    const pinH = isZone ? 46 : 30;
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, pinH, 6),
      mat.clone() as THREE.Material,
    );
    pin.position.set(x, pinH / 2, z);
    group.add(pin);
    // Text label above named nodes. Stagger the clustered zone labels across a
    // few heights, and lift key nodes (exit/destination/filtration/city) higher.
    if (p.name) {
      const labelY = isZone
        ? 54 + (zoneIdx % 3) * 11
        : p.type === 'danger_zone' || p.type === 'shelter'
          ? 36
          : 62;
      group.add(makeLabel(p.name, color, x, labelY, z));
    }
    if (isZone) zoneIdx++;
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
    addEncirclement(group, cx, cz, ringR * 1.2);
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

/**
 * Animated evacuees: small emissive markers that flow from each origin zone to
 * the western exit and then out along the corridor, looping continuously. This
 * is the schematic analogue of the Vegas runners moving on the route — a
 * lightweight instanced animation (no backend, no per-runner agent). It sets
 * {@link Context.schematicUpdate}, which the render loop ticks each frame.
 */
function addEvacuees(
  ctx: Context,
  pois: SitePoi[],
  corridor: GeoAnchor[],
  project: Projector,
): void {
  const origins = pois.filter((p) => p.type === 'origin_zone');
  if (!origins.length) return;
  const exit = pois.find((p) => p.type === 'exit');
  const exitW = exit ? project(exit.lon, exit.lat) : null;
  const corridorPts = corridor.map((p) => {
    const { x, z } = project(p.lon, p.lat);
    return new THREE.Vector3(x, 1.6, z);
  });

  // One flow curve per origin: origin → exit → along the corridor.
  const curves: THREE.CatmullRomCurve3[] = [];
  for (const o of origins) {
    const w = project(o.lon, o.lat);
    const pts: THREE.Vector3[] = [new THREE.Vector3(w.x, 1.6, w.z)];
    if (exitW) pts.push(new THREE.Vector3(exitW.x, 1.6, exitW.z));
    for (const c of corridorPts) pts.push(c.clone());
    if (pts.length >= 2) curves.push(new THREE.CatmullRomCurve3(pts));
  }
  if (!curves.length) return;

  // Distribute agents across cohorts weighted by zone population; each agent
  // carries its origin-zone tag + id, so the cohort data travels with it on
  // every tick (the schematic analogue of per-runner simulation state).
  const TOTAL = 80;
  const pops = origins.map((o) => Math.max(1, o.population ?? 1));
  const popSum = pops.reduce((a, b) => a + b, 0);
  const counts = pops.map((p) => Math.max(4, Math.round((TOTAL * p) / popSum)));
  const count = counts.reduce((a, b) => a + b, 0);

  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.1, 8, 8),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    count,
  );
  mesh.name = 'schematic-evacuees';
  mesh.frustumCulled = false;

  const state: { ci: number; t: number; speed: number; zoneId: string; tag: string }[] = [];
  const color = new THREE.Color();
  let idx = 0;
  for (let ci = 0; ci < curves.length; ci++) {
    const o = origins[ci];
    const zoneId = o.zoneId ?? `Z${ci + 1}`;
    const tag = o.tag ?? `zone-${ci + 1}`;
    const hex = ZONE_COLORS[ci % ZONE_COLORS.length];
    for (let k = 0; k < counts[ci]; k++) {
      state.push({ ci, t: k / counts[ci], speed: 0.02 + Math.random() * 0.03, zoneId, tag });
      mesh.setColorAt(idx, color.setHex(hex));
      idx++;
    }
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const rot = new THREE.Quaternion();
  const scl = new THREE.Vector3(1, 1, 1);
  const writeAll = (): void => {
    for (let i = 0; i < state.length; i++) {
      const st = state[i];
      curves[st.ci].getPoint(st.t, pos);
      m.compose(pos, rot, scl);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  writeAll();
  ctx.scene.add(mesh);

  ctx.schematicUpdate = (delta: number): void => {
    for (let i = 0; i < state.length; i++) {
      const st = state[i];
      st.t += st.speed * delta;
      if (st.t >= 1) st.t -= 1;
    }
    writeAll();
  };
}

