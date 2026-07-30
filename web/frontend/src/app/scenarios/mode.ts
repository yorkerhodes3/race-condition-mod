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
 * Speed & movement-mode model (see docs/DESIGN-CHANGES-SITE-Purpose.md §4.9).
 *
 * The Vegas marathon is single-mode: everyone travels on `foot`. An evacuation
 * mixes modes (foot / car / bus / train) with distinct speed bands, capacities,
 * and route eligibility. This module declares that taxonomy and its per-mode
 * profiles while keeping the Vegas default to foot-only, so nothing changes for
 * the marathon.
 *
 * This module is pure: no three.js, no DOM. Safe to import from the browser
 * bundle and the node/vitest parity guards.
 */

/** Movement mode. `foot` is the marathon default; the rest are reserved (§4.9). */
export type MovementMode = 'foot' | 'car' | 'bus' | 'train';

export const MOVEMENT_MODES: readonly MovementMode[] = ['foot', 'car', 'bus', 'train'];

/**
 * Per-mode physical profile. `capacity` is occupants per unit; `roadsOnly`
 * gates corridor eligibility (§4.2 `Feature.properties.modes`). Speed band is in
 * mph.
 */
export interface ModeProfile {
  readonly mode: MovementMode;
  readonly minMph: number;
  readonly maxMph: number;
  readonly capacity: number;
  readonly roadsOnly: boolean;
}

/** Foot: the marathon mode — walk→run band, one occupant, any corridor. */
export const FOOT_PROFILE: ModeProfile = {
  mode: 'foot',
  minMph: 2,
  maxMph: 13,
  capacity: 1,
  roadsOnly: false,
};

/** Reserved evacuation modes (not enabled for Vegas). */
export const CAR_PROFILE: ModeProfile = {
  mode: 'car',
  minMph: 5,
  maxMph: 60,
  capacity: 4,
  roadsOnly: true,
};
export const BUS_PROFILE: ModeProfile = {
  mode: 'bus',
  minMph: 5,
  maxMph: 45,
  capacity: 40,
  roadsOnly: true,
};
export const TRAIN_PROFILE: ModeProfile = {
  mode: 'train',
  minMph: 20,
  maxMph: 80,
  capacity: 300,
  roadsOnly: true,
};

export const MODE_PROFILES: Readonly<Record<MovementMode, ModeProfile>> = {
  foot: FOOT_PROFILE,
  car: CAR_PROFILE,
  bus: BUS_PROFILE,
  train: TRAIN_PROFILE,
};

/** Which modes a scenario enables, and the default assigned to unlabeled agents. */
export interface MovementModeModel {
  readonly id: string;
  readonly name: string;
  readonly enabledModes: readonly MovementMode[];
  readonly defaultMode: MovementMode;
}

/** Las Vegas: foot only — the single-mode marathon. */
export const VEGAS_FOOT_ONLY: MovementModeModel = {
  id: 'vegas-foot',
  name: 'Foot only (marathon)',
  enabledModes: ['foot'],
  defaultMode: 'foot',
};

/**
 * Mariupol mixed (P7) — most evacuees on foot, with buses on the corridor where
 * permitted. Opt-in via `?movement=mariupol-mixed`; Vegas is unaffected.
 */
export const MARIUPOL_MIXED: MovementModeModel = {
  id: 'mariupol-mixed',
  name: 'Foot + bus (corridor)',
  enabledModes: ['foot', 'bus'],
  defaultMode: 'foot',
};

/** Registry of known movement-mode models. */
export const MOVEMENT_MODE_MODELS: Readonly<Record<string, MovementModeModel>> = {
  [VEGAS_FOOT_ONLY.id]: VEGAS_FOOT_ONLY,
  [MARIUPOL_MIXED.id]: MARIUPOL_MIXED,
};

export const DEFAULT_MOVEMENT_MODE_MODEL_ID = 'vegas-foot';

/**
 * Resolve the active movement-mode model id from (1) `?movement=`, then
 * (2) `window.ENV.MOVEMENT`, defaulting to the foot-only Vegas model. Guarded
 * for node/vitest where `window` is absent.
 */
export function resolveMovementModeModelId(): string {
  if (typeof window !== 'undefined') {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get('movement');
      if (fromQuery && MOVEMENT_MODE_MODELS[fromQuery]) {
        return fromQuery;
      }
      const env = (window as unknown as { ENV?: { MOVEMENT?: string } }).ENV;
      if (env?.MOVEMENT && MOVEMENT_MODE_MODELS[env.MOVEMENT]) {
        return env.MOVEMENT;
      }
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT_MOVEMENT_MODE_MODEL_ID;
}

let _activeMovementModel: MovementModeModel | null = null;

/** The active movement-mode model, resolved once and cached. */
export function getActiveMovementModel(): MovementModeModel {
  if (_activeMovementModel === null) {
    _activeMovementModel = MOVEMENT_MODE_MODELS[resolveMovementModeModelId()] ?? VEGAS_FOOT_ONLY;
  }
  return _activeMovementModel;
}

/** True when `mode` is enabled by the given model. */
export function isModeEnabled(model: MovementModeModel, mode: MovementMode): boolean {
  return model.enabledModes.includes(mode);
}
