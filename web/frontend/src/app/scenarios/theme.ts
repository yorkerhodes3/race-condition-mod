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
 * Theme Pack — the swappable visual "tone" of a scenario (bloom, emissive
 * glows). Like the Site Pack (scenarios/site.ts) this module is dependency-free
 * (no three.js, colors are plain hex ints) so it can be unit-tested in isolation
 * and swapped without touching shader/post-processing code.
 *
 * P1 goal: introduce this seam WITHOUT changing behavior. Only the neon-night
 * Vegas theme is registered, holding the exact pre-refactor literals, so the
 * scene renders identically. A future muted "evac" theme dials bloom down and
 * neutralizes the glows by registering another Theme here.
 *
 * See docs/DESIGN-CHANGES-SITE-Purpose.md §4.5.
 */

/** UnrealBloomPass parameters (strength, radius, threshold). */
export interface BloomParams {
  strength: number;
  radius: number;
  threshold: number;
}

/** Emissive tint + intensity for the city/roads GLB material. */
export interface EmissiveParams {
  /** Hex color, e.g. 0x334455. */
  color: number;
  intensity: number;
}

/** A Theme Pack: the tone knobs the look-dev pipeline reads. */
export interface Theme {
  id: string;
  name: string;
  bloom: BloomParams;
  /** Emissive applied to the loaded city/roads mesh. */
  roadEmissive: EmissiveParams;
  /** Hex color of the emissive window glow in the height-fog material. */
  windowGlowColor: number;
}

/**
 * Las Vegas "neon night" — the original theme. These are the exact literals that
 * previously lived inline in viewport/scene/postprocessing.ts (bloom),
 * glb-roads.ts (road emissive), and viewport/shaders/height-fog-shader.ts
 * (window glow). Parity with the pre-refactor render depends on them being
 * byte-for-byte identical (guarded by theme.spec.ts).
 */
export const VEGAS_NEON_THEME: Theme = {
  id: 'vegas-neon',
  name: 'Las Vegas Neon Night',
  bloom: { strength: 0.12, radius: 0.5, threshold: 0.02 },
  roadEmissive: { color: 0x334455, intensity: 0.4 },
  windowGlowColor: 0xb0bcbf,
};

/**
 * Mariupol siege — a muted, low-glow tone for the schematic evacuation scenario
 * (P7). Deliberately un-festive: minimal bloom and dim, cold emissives (the
 * legible danger/route/shelter coloring lives on the POI markers, not the city
 * tone). Opt-in via `?theme=mariupol-siege`; Vegas is unaffected.
 */
export const MARIUPOL_SIEGE_THEME: Theme = {
  id: 'mariupol-siege',
  name: 'Mariupol Siege (schematic)',
  bloom: { strength: 0.0, radius: 0.4, threshold: 0.1 },
  roadEmissive: { color: 0x3a3f45, intensity: 0.15 },
  windowGlowColor: 0x6b7378,
};

/** Registry of known themes. Additional themes (e.g. evac-muted) register here. */
export const THEMES: Record<string, Theme> = {
  [VEGAS_NEON_THEME.id]: VEGAS_NEON_THEME,
  [MARIUPOL_SIEGE_THEME.id]: MARIUPOL_SIEGE_THEME,
};

/** Fallback theme when nothing is selected or an unknown id is requested. */
export const DEFAULT_THEME_ID = 'vegas-neon';

/**
 * Resolve the active theme id from (in priority order) the `?theme=` query
 * param, then `window.ENV.THEME`, then the default. Never throws; safe outside
 * a browser (vitest / node).
 */
function resolveThemeId(): string {
  let fromQuery = '';
  let fromEnv = '';
  try {
    if (typeof window !== 'undefined' && window.location) {
      fromQuery = new URLSearchParams(window.location.search).get('theme') ?? '';
    }
  } catch {
    /* not in a browser; ignore */
  }
  try {
    const env = (globalThis as unknown as { ENV?: { THEME?: string } }).ENV;
    if (env && typeof env.THEME === 'string') {
      fromEnv = env.THEME;
    }
  } catch {
    /* no runtime env; ignore */
  }
  const id = (fromQuery || fromEnv || '').trim().toLowerCase();
  return id && THEMES[id] ? id : DEFAULT_THEME_ID;
}

let _activeTheme: Theme | null = null;

/** The active Theme Pack for this session. Resolved once and cached. */
export function getActiveTheme(): Theme {
  if (!_activeTheme) {
    _activeTheme = THEMES[resolveThemeId()] ?? VEGAS_NEON_THEME;
  }
  return _activeTheme;
}
