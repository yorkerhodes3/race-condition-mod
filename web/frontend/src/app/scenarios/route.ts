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
 * Route Pack — the single source of truth for the active scenario's route
 * semantics (see docs/DESIGN-CHANGES-SITE-Purpose.md §4.2).
 *
 * The Las Vegas marathon is one closed loop the whole field follows, integrated
 * by scalar distance. An evacuation twin instead has multiple directed
 * corridors leading away from a hazard toward exits/shelters. This module makes
 * the marathon's implicit semantics explicit and data-driven, while keeping the
 * distance-along-a-path interpolation core unchanged.
 *
 * This module is pure: no three.js, no DOM. It is safe to import from both the
 * browser bundle and the node/vitest parity guards.
 */

/** Route family. `marathon` = today's single closed loop; `evacuation` reserved. */
export type RouteType = 'marathon' | 'evacuation';

/**
 * Role a route plays within its scenario. `loop` is the marathon default;
 * the others are reserved for the evacuation twin (RFC §4.2).
 */
export type RouteRole = 'loop' | 'corridor' | 'approach' | 'contraflow';

/**
 * Scalar semantics of the active route. `distanceMi` is the authoritative race
 * distance used to convert progress `t = distanceMi / MARATHON_DISTANCE_MI`.
 */
export interface RouteProfile {
  readonly id: string;
  readonly name: string;
  readonly routeType: RouteType;
  readonly role: RouteRole;
  /** True when the field follows one closed LineString (marathon). */
  readonly closedLoop: boolean;
  /** Authoritative course distance in miles (matches backend MARATHON_MI). */
  readonly distanceMi: number;
}

/**
 * Las Vegas marathon route. `distanceMi` holds the exact pre-refactor constant
 * (official marathon distance) so progress integration is unchanged.
 */
export const VEGAS_MARATHON_ROUTE: RouteProfile = {
  id: 'vegas-marathon',
  name: 'Las Vegas Strip Marathon',
  routeType: 'marathon',
  role: 'loop',
  closedLoop: true,
  distanceMi: 26.2188,
};

/**
 * Mariupol humanitarian corridor (P7) — a single directed evacuation route
 * away from the besieged city toward a safe destination (Mariupol →
 * Zaporizhzhia is ~227 km). `distanceMi` is a documented estimate pending the
 * georeferenced corridor polyline (see docs/P7-MARIUPOL-PREP.md). Opt-in via
 * `?route=mariupol-corridor`; Vegas is unaffected.
 */
export const MARIUPOL_CORRIDOR_ROUTE: RouteProfile = {
  id: 'mariupol-corridor',
  name: 'Mariupol humanitarian corridor',
  routeType: 'evacuation',
  role: 'corridor',
  closedLoop: false,
  distanceMi: 141.0,
};

/** Registry of known routes. */
export const ROUTES: Readonly<Record<string, RouteProfile>> = {
  [VEGAS_MARATHON_ROUTE.id]: VEGAS_MARATHON_ROUTE,
  [MARIUPOL_CORRIDOR_ROUTE.id]: MARIUPOL_CORRIDOR_ROUTE,
};

export const DEFAULT_ROUTE_ID = 'vegas-marathon';

/**
 * Resolve the active route id from (1) a `?route=` query param, then
 * (2) `window.ENV.ROUTE`, defaulting to the Vegas marathon. Guarded so it is
 * safe under node/vitest where `window` is absent.
 */
export function resolveRouteId(): string {
  if (typeof window !== 'undefined') {
    try {
      const fromQuery = new URLSearchParams(window.location.search).get('route');
      if (fromQuery && ROUTES[fromQuery]) {
        return fromQuery;
      }
      const env = (window as unknown as { ENV?: { ROUTE?: string } }).ENV;
      if (env?.ROUTE && ROUTES[env.ROUTE]) {
        return env.ROUTE;
      }
    } catch {
      /* fall through to default */
    }
  }
  return DEFAULT_ROUTE_ID;
}

let _activeRoute: RouteProfile | null = null;

/** The active route profile, resolved once and cached. */
export function getActiveRoute(): RouteProfile {
  if (_activeRoute === null) {
    _activeRoute = ROUTES[resolveRouteId()] ?? VEGAS_MARATHON_ROUTE;
  }
  return _activeRoute;
}
