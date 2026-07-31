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
 * Copy Pack — the scenario-tied terminology schema (P7).
 *
 * A marathon has "runners" who "cross the finish line"; an evacuation has
 * "evacuees" who "reach safety". This module maps the display language to the
 * active scenario so the HUD, the log, and tool labels read correctly. It is
 * keyed to the active Site id, so selecting `?scenario=mariupol` also re-words
 * the UI.
 *
 * The Vegas copy is the identity (today's marathon wording), so Vegas is
 * unchanged. Pure: no three.js, no DOM. `reword()` runs at display time because
 * cached recordings bake the original wording into their log text.
 */
import { getActiveSite } from './site';
import { MARIUPOL_FACTS } from './mariupol-data';

export interface ScenarioCopy {
  readonly id: string;
  /** e.g. 'runner' / 'evacuee'. */
  readonly participantSingular: string;
  /** e.g. 'runners' / 'evacuees'. */
  readonly participantPlural: string;
  /** Capitalized singular used in per-agent labels, e.g. 'Runner 12' → 'Evacuee 12'. */
  readonly participantTitle: string;
  /** HUD panel heading. */
  readonly hudTitle: string;
  /** HUD "finishers" stat label. */
  readonly finishersLabel: string;
  /** HUD average-distance stat label. */
  readonly distanceLabel: string;
  /** HUD average-pace stat label. */
  readonly paceLabel: string;
  /** "crossed the finish line" → e.g. "reached safety". */
  readonly finishPhrase: string;
  /** Human noun for the run, e.g. 'marathon' / 'evacuation'. */
  readonly activityNoun: string;
  /** City/place name in cached cards, e.g. 'Las Vegas' / 'Mariupol'. */
  readonly cityName: string;
  /** Full simulated-route title in cached cards, e.g. 'Las Vegas Neon Night Marathon'. */
  readonly routeName: string;
  /** Plan card title, e.g. 'Vegas Strip Marathon Plan'. */
  readonly planName: string;
  /** The three cached route-card titles, remapped 1:1 (index-aligned). */
  readonly routeNames: readonly [string, string, string];
  /** Theme/subtitle label, e.g. 'Neon Strip Run'. */
  readonly themeLabel: string;
  /** Route "Total distance" value shown on cards, e.g. '26.2 miles'. */
  readonly routeDistance: string;
  /** Event/assessment date shown on the plan card, e.g. 'November 17, 2024'. */
  readonly eventDate: string;
  /** Expected participant count on cards, e.g. '10,000'. */
  readonly expectedParticipants: string;
}

export const VEGAS_COPY: ScenarioCopy = {
  id: 'vegas',
  participantSingular: 'runner',
  participantPlural: 'runners',
  participantTitle: 'Runner',
  hudTitle: 'Simulation progress',
  finishersLabel: 'RACE FINISHERS',
  distanceLabel: 'AVG. DISTANCE',
  paceLabel: 'AVG. PACE',
  finishPhrase: 'crossed the finish line',
  activityNoun: 'marathon',
  cityName: 'Las Vegas',
  routeName: 'Las Vegas Neon Night Marathon',
  planName: 'Vegas Strip Marathon Plan',
  routeNames: ['Las Vegas Boulevard', 'Grand Loop', 'East Side Explorer'],
  themeLabel: 'Neon Strip Run',
  routeDistance: '26.2 miles',
  eventDate: 'November 17, 2024',
  expectedParticipants: '10,000',
};

export const MARIUPOL_COPY: ScenarioCopy = {
  id: 'mariupol',
  participantSingular: 'evacuee',
  participantPlural: 'evacuees',
  participantTitle: 'Evacuee',
  hudTitle: 'Evacuation progress',
  finishersLabel: 'EVACUEES SAFE',
  distanceLabel: 'AVG. DISTANCE',
  paceLabel: 'AVG. PACE',
  finishPhrase: 'reached safety',
  activityNoun: 'evacuation',
  cityName: 'Mariupol',
  routeName: 'Mariupol → Zaporizhzhia Corridor',
  planName: 'Mariupol Evacuation Plan',
  routeNames: [
    'Central Corridor · Zones 1–2 → Exit West',
    'North Corridor · Zones 3–4 → Exit West',
    'Coastal Corridor · Zone 5 → Exit West',
  ],
  themeLabel: 'Self-evacuation corridor',
  routeDistance: `${MARIUPOL_FACTS.corridorKm} km`,
  eventDate: MARIUPOL_FACTS.assessmentDate,
  expectedParticipants: '37,663',
};

/**
 * Evacuation copy for the case-study cities (Paris/Barcelona/Venice/NYC). Same
 * evacuee wording as Mariupol, with the city's own proper nouns for any cached
 * card that surfaces under that scenario. Registered per city as it ships.
 */
function makeCityEvacCopy(id: string, city: string): ScenarioCopy {
  return {
    id,
    participantSingular: 'evacuee',
    participantPlural: 'evacuees',
    participantTitle: 'Evacuee',
    hudTitle: 'Evacuation progress',
    finishersLabel: 'EVACUEES SAFE',
    distanceLabel: 'AVG. DISTANCE',
    paceLabel: 'AVG. PACE',
    finishPhrase: 'reached safety',
    activityNoun: 'evacuation',
    cityName: city,
    routeName: `${city} Evacuation Corridor`,
    planName: `${city} Evacuation Plan`,
    routeNames: [`${city} Corridor A`, `${city} Corridor B`, `${city} Corridor C`],
    themeLabel: 'Evacuation corridor',
    routeDistance: '4 km',
    eventDate: 'exercise scenario',
    expectedParticipants: '12,000',
  };
}

const CITY_EVAC_COPY: Record<string, ScenarioCopy> = {
  paris: makeCityEvacCopy('paris', 'Paris'),
  barcelona: makeCityEvacCopy('barcelona', 'Barcelona'),
  venice: makeCityEvacCopy('venice', 'Venice'),
};

/** Registry keyed by Site id. */
export const COPY: Readonly<Record<string, ScenarioCopy>> = {
  [VEGAS_COPY.id]: VEGAS_COPY,
  [MARIUPOL_COPY.id]: MARIUPOL_COPY,
  ...CITY_EVAC_COPY,
};

/** The active copy, resolved from the active Site (falls back to Vegas). */
export function getActiveCopy(): ScenarioCopy {
  return COPY[getActiveSite().id] ?? VEGAS_COPY;
}

/**
 * Re-word recorded/marathon display text into the given scenario's language.
 * A no-op for Vegas (identity copy). Case-aware for the common capitalizations.
 */
export function rewordWith(text: string, copy: ScenarioCopy): string {
  if (!text || copy.id === 'vegas') return text;
  return text
    .replace(/Las Vegas Boulevard/gi, copy.routeNames[0])
    .replace(/Grand Loop/gi, copy.routeNames[1])
    .replace(/East Side Explorer/gi, copy.routeNames[2])
    .replace(/Las Vegas Neon Night Marathon/gi, copy.routeName)
    .replace(/Vegas Strip Marathon Plan/gi, copy.planName)
    .replace(/Neon Strip Run/gi, copy.themeLabel)
    .replace(/Las Vegas/gi, copy.cityName)
    .replace(/26\.2 miles/gi, copy.routeDistance)
    .replace(/November 17, 2024/gi, copy.eventDate)
    .replace(/\b10,000\b/g, copy.expectedParticipants)
    .replace(/crossed the finish line/gi, copy.finishPhrase)
    .replace(/\bRunners\b/g, capitalize(copy.participantPlural))
    .replace(/\brunners\b/g, copy.participantPlural)
    .replace(/\bRunner\b/g, copy.participantTitle)
    .replace(/\brunner\b/g, copy.participantSingular)
    .replace(/\bMarathon\b/g, capitalize(copy.activityNoun))
    .replace(/\bmarathon\b/g, copy.activityNoun);
}

/** {@link rewordWith} using the active copy. */
export function reword(text: string): string {
  return rewordWith(text, getActiveCopy());
}

/**
 * Generic display name for the race-collector tools, so the log reads
 * scenario-neutrally: `start_race_collector` → `start_sim_collector`, etc.
 * Leaves other names unchanged. (Display-only; the wire protocol is unchanged.)
 */
export function genericToolName(name: string): string {
  if (name === 'start_race_collector') return 'start_sim_collector';
  if (name === 'stop_race_collector') return 'stop_sim_collector';
  return name;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
