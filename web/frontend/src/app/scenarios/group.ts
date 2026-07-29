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
 * Group cohesion model (see docs/DESIGN-CHANGES-SITE-Purpose.md §4.6).
 *
 * A marathon field is a cloud of independent runners. An evacuation moves as
 * households/clusters that stay together and pace to their slowest member.
 * This module makes group membership and cohesion an explicit, data-driven
 * seam. The Las Vegas default is "no groups" (every runner is their own group,
 * cohesion 0), which reproduces today's independent-particle behavior exactly.
 *
 * This module is pure: no three.js, no DOM. Safe to import from both the browser
 * bundle and the node/vitest parity guards.
 */

/** Role of a member within a group. Drives pace/vulnerability weighting later. */
export type GroupRole = 'adult' | 'child' | 'elder' | 'caregiver' | 'assisted';

export const GROUP_ROLES: readonly GroupRole[] = [
  'adult',
  'child',
  'elder',
  'caregiver',
  'assisted',
] as const;

/** Default role when a scenario does not assign one. */
export const DEFAULT_GROUP_ROLE: GroupRole = 'adult';

/**
 * How strongly a scenario's agents stay together. `defaultCohesionTarget` in
 * [0,1]: 0 = independent (own pace), 1 = fully paced to the slowest member.
 */
export interface GroupCohesionModel {
  readonly id: string;
  readonly name: string;
  readonly defaultCohesionTarget: number;
}

/**
 * Las Vegas marathon: no groups. `defaultCohesionTarget = 0` makes every runner
 * move at its own pace — identical to the pre-refactor behavior.
 */
export const VEGAS_NO_GROUPS: GroupCohesionModel = {
  id: 'vegas-independent',
  name: 'Independent runners (no groups)',
  defaultCohesionTarget: 0,
};

/** Registry of known group-cohesion models. */
export const GROUP_MODELS: Readonly<Record<string, GroupCohesionModel>> = {
  [VEGAS_NO_GROUPS.id]: VEGAS_NO_GROUPS,
};

export const DEFAULT_GROUP_MODEL_ID = 'vegas-independent';

/**
 * Resolve the active group-cohesion model id from (1) a `?groups=` query param,
 * then (2) `window.ENV.GROUPS`, defaulting to the independent Vegas model.
 * Guarded for node/vitest where `window` is absent.
 */
export function resolveGroupModelId(): string {
  if (typeof window !== 'undefined') {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get('groups');
      if (fromQuery && GROUP_MODELS[fromQuery]) {
        return fromQuery;
      }
      const env = (window as unknown as { ENV?: { GROUPS?: string } }).ENV;
      if (env?.GROUPS && GROUP_MODELS[env.GROUPS]) {
        return env.GROUPS;
      }
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT_GROUP_MODEL_ID;
}

let _activeGroupModel: GroupCohesionModel | null = null;

/** The active group-cohesion model, resolved once and cached. */
export function getActiveGroupModel(): GroupCohesionModel {
  if (_activeGroupModel === null) {
    _activeGroupModel = GROUP_MODELS[resolveGroupModelId()] ?? VEGAS_NO_GROUPS;
  }
  return _activeGroupModel;
}

/**
 * Multiplicative speed factor that paces an agent toward its slowest group
 * member. Returns a value in (0, 1]: `1` means "own pace, no throttle".
 *
 * - `cohesionTarget = 0` (the Vegas default) always returns `1` — an exact
 *   no-op, so the marathon field is unchanged.
 * - `cohesionTarget = 1` returns `slowestGroupMph / ownMph` — fully paced to the
 *   slowest member.
 *
 * A single/lead runner whose slowest member is itself gets `1`. Non-positive or
 * non-finite inputs are treated as "no throttle" for safety.
 */
export function cohesionSpeedFactor(
  cohesionTarget: number,
  ownMph: number,
  slowestGroupMph: number,
): number {
  if (!(cohesionTarget > 0) || !(ownMph > 0) || !Number.isFinite(slowestGroupMph)) {
    return 1;
  }
  const ratio = Math.min(1, Math.max(0, slowestGroupMph / ownMph));
  const factor = 1 - cohesionTarget * (1 - ratio);
  return Math.min(1, Math.max(0, factor));
}
