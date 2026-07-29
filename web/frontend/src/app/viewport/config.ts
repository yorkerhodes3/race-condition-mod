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

import * as THREE from 'three';
import { getActiveSite } from '../scenarios/site';

/** Tweakable fog far-plane distance; mutated by the Tweakpane debug panel. */
export const baseFog = { far: 9000 };

/** World-space offset from the orbit target to the directional light. */
export const lightOffset = new THREE.Vector3(-6000, 5000, 5000);

// ── Map center ──────────────────────────────────────────────────────────────
// The lat/lon that appears at the origin of the 3D world, sourced from the
// active Site Pack (scenarios/site.ts). For the default Vegas scenario these are
// the exact pre-refactor values 36.1085 / -115.1769.
export const MAP_CENTER_LAT = getActiveSite().mapCenter.lat;
export const MAP_CENTER_LON = getActiveSite().mapCenter.lon;
