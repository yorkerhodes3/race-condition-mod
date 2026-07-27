import type {
  TwinRequest,
  TwinResponse,
  StateMutation,
} from '@dtsf/types';
import { BaseBehaviorPack } from '@dtsf/twin-sdk';

/**
 * Race Condition gateway twin.
 *
 * Reproduces the Go gateway's REST control plane (see race-condition
 * docs/api/REFERENCE.md and cmd/gateway/main.go) as a deterministic,
 * stateful DTSF twin. All IDs are derived from the manifest `seed` + an
 * in-state counter so runs are reproducible and snapshot/replay friendly.
 *
 * State model (set-only, no delete semantics required):
 *   sessions:    Record<sessionId, SessionRecord>
 *   simulations: Record<simulationId, true>
 *   counter:     number   (monotonic, drives deterministic session IDs)
 *
 * NOTE: the DTSF runtime persists each mutation under the composed key
 * `${entity}:${key}` (see twin-runtime.ts). This pack uses entity="gateway",
 * so reads MUST use the `gateway:` prefix (e.g. state.get('gateway:sessions')).
 *
 * NOT modeled: the realtime /ws WebSocket event stream. DTSF twins are
 * HTTP request/response clones; the Angular frontend replays the event
 * stream client-side in Cached mode. See pack README.md.
 */

interface SessionRecord {
  sessionId: string;
  agentType: string;
  userId?: string;
  simulationId?: string;
  status: 'pending';
}

const KNOWN_RESET_TARGETS = ['sessions', 'queues', 'maps', 'pubsub'] as const;

const AGENT_CARDS: Record<string, { name: string; url: string; description: string }> = {
  planner: {
    name: 'planner',
    url: 'http://planner:9105',
    description: 'Designs marathon routes (GIS + financial modeling).',
  },
  simulator: {
    name: 'simulator',
    url: 'http://simulator:9104',
    description: 'Runs the race pipeline tick-by-tick.',
  },
  runner: {
    name: 'runner',
    url: 'http://runner:9108',
    description: 'LLM-powered NPC marathon runner.',
  },
  runner_autopilot: {
    name: 'runner_autopilot',
    url: 'http://runner-autopilot:9110',
    description: 'Deterministic runner (no LLM calls).',
  },
};

export class RaceConditionGatewayPack extends BaseBehaviorPack {
  private json(status: number, body: unknown): TwinResponse {
    return {
      status,
      headers: {
        'content-type': 'application/json',
        // Permit a cross-origin frontend (e.g. GitHub Pages) to call the twin.
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body,
    };
  }

  private getSessions(state: Map<string, unknown>): Record<string, SessionRecord> {
    return { ...((state.get('gateway:sessions') as Record<string, SessionRecord>) ?? {}) };
  }

  private getSimulations(state: Map<string, unknown>): Record<string, true> {
    return { ...((state.get('gateway:simulations') as Record<string, true>) ?? {}) };
  }

  private getCounter(state: Map<string, unknown>): number {
    return (state.get('gateway:counter') as number) ?? 0;
  }

  private nextId(seed: number, n: number): string {
    // Deterministic, reproducible across seeded runs.
    return `sess-${seed}-${String(n).padStart(6, '0')}`;
  }

  /** Small deterministic PRNG (mulberry32) so replays are reproducible per seed. */
  private rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Build a deterministic race-replay trajectory from current twin state.
   * This is the twin-side of "Option 3": rather than a live WebSocket stream
   * (which the DTSF pack contract cannot hold open), the twin returns a full
   * trajectory in one response and the client replays it with timing — the
   * same pattern the Race Condition frontend uses for Cached mode.
   */
  private buildReplay(state: Map<string, unknown>, query: Record<string, string>): unknown {
    const sessions = this.getSessions(state);
    const existing = Object.keys(sessions);
    const wantRunners = Math.max(1, Math.min(Number(query.runners) || existing.length || 8, 64));
    const ticks = Math.max(1, Math.min(Number(query.ticks) || 60, 200));
    const simulationId =
      query.simulation_id || Object.keys(this.getSimulations(state))[0] || 'replay';

    const ids =
      existing.length > 0
        ? existing.slice(0, wantRunners)
        : Array.from({ length: wantRunners }, (_, i) => this.nextId(this.context.seed, i + 1));

    const rand = this.rng(this.context.seed + ids.length + ticks);
    // Per-runner baseline pace (fraction of the course covered per tick).
    const runners = ids.map((id) => ({
      id,
      agentType: sessions[id]?.agentType ?? 'runner_autopilot',
      basePace: 1 / ticks + (rand() - 0.5) * (0.4 / ticks),
    }));

    const progress = new Array(runners.length).fill(0);
    const frames: Array<{ tick: number; positions: Array<{ id: string; progress: number; pace: number }> }> = [];
    for (let t = 1; t <= ticks; t++) {
      const positions = runners.map((r, i) => {
        const jitter = (rand() - 0.5) * (0.6 / ticks);
        const pace = Math.max(0, r.basePace + jitter);
        progress[i] = Math.min(1, progress[i] + pace);
        return { id: r.id, progress: Number(progress[i].toFixed(4)), pace: Number(pace.toFixed(5)) };
      });
      frames.push({ tick: t, positions });
    }

    return {
      simulation_id: simulationId,
      seed: this.context.seed,
      ticks,
      minutes_per_tick: 1,
      runners: runners.map((r) => ({ id: r.id, agentType: r.agentType })),
      frames,
    };
  }

  async handleRequest(
    req: TwinRequest,
    state: Map<string, unknown>,
  ): Promise<{ response: TwinResponse; mutations: StateMutation[] }> {
    const { method, path } = req;

    // --- CORS preflight (lets a GitHub Pages / cross-origin frontend call us) ---
    if (method === 'OPTIONS') {
      return {
        response: {
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET,POST,OPTIONS',
            'access-control-allow-headers': 'content-type',
            'access-control-max-age': '86400',
          },
          body: '',
        },
        mutations: [],
      };
    }

    // --- Health / config -------------------------------------------------
    if (method === 'GET' && path === '/health') {
      return {
        response: this.json(200, { status: 'ok', service: 'gateway', twin: this.context.twinName }),
        mutations: [],
      };
    }
    if (method === 'GET' && path === '/config') {
      return { response: this.json(200, { max_runners: 100 }), mutations: [] };
    }

    // --- Agent discovery -------------------------------------------------
    if (method === 'GET' && path === '/api/v1/agent-types') {
      return { response: this.json(200, AGENT_CARDS), mutations: [] };
    }

    // --- Sessions --------------------------------------------------------
    if (method === 'GET' && path === '/api/v1/sessions') {
      return { response: this.json(200, Object.keys(this.getSessions(state))), mutations: [] };
    }

    if (method === 'POST' && path === '/api/v1/sessions') {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const agentType = body.agentType as string | undefined;
      const userId = body.userId as string | undefined;
      if (!agentType || !userId) {
        return {
          response: this.json(400, { error: 'agentType and userId are required' }),
          mutations: [],
        };
      }
      const simulationId = (body.simulation_id as string | undefined) ?? undefined;
      const counter = this.getCounter(state) + 1;
      const sessionId = this.nextId(this.context.seed, counter);
      const sessions = this.getSessions(state);
      sessions[sessionId] = { sessionId, agentType, userId, simulationId, status: 'pending' };
      const simulations = this.getSimulations(state);
      if (simulationId) simulations[simulationId] = true;

      return {
        response: this.json(201, {
          status: 'pending',
          sessionId,
          message: 'spawn event published to orchestration channel (twin)',
        }),
        mutations: [
          { type: 'set', entity: 'gateway', key: 'sessions', value: sessions },
          { type: 'set', entity: 'gateway', key: 'simulations', value: simulations },
          { type: 'set', entity: 'gateway', key: 'counter', value: counter },
        ],
      };
    }

    if (method === 'POST' && path === '/api/v1/sessions/flush') {
      const count = Object.keys(this.getSessions(state)).length;
      return {
        response: this.json(200, { status: 'flushed', count }),
        mutations: [{ type: 'set', entity: 'gateway', key: 'sessions', value: {} }],
      };
    }

    // --- Batch spawn -----------------------------------------------------
    if (method === 'POST' && path === '/api/v1/spawn') {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const agents = body.agents as Array<{ agentType?: string; count?: number }> | undefined;
      if (!Array.isArray(agents) || agents.length === 0) {
        return {
          response: this.json(400, { error: 'agents[] is required' }),
          mutations: [],
        };
      }
      const simulationId = (body.simulation_id as string | undefined) ?? `sim-${this.context.seed}-${this.getCounter(state) + 1}`;
      const sessions = this.getSessions(state);
      const simulations = this.getSimulations(state);
      simulations[simulationId] = true;
      let counter = this.getCounter(state);
      const created: string[] = [];
      for (const a of agents) {
        const agentType = a.agentType;
        const count = Math.max(0, Math.floor(a.count ?? 0));
        if (!agentType) {
          return { response: this.json(400, { error: 'each agent requires agentType' }), mutations: [] };
        }
        for (let i = 0; i < count; i++) {
          counter += 1;
          const sessionId = this.nextId(this.context.seed, counter);
          sessions[sessionId] = { sessionId, agentType, simulationId, status: 'pending' };
          created.push(sessionId);
        }
      }

      return {
        response: this.json(201, {
          status: 'spawned',
          simulation_id: simulationId,
          count: created.length,
          sessions: created,
        }),
        mutations: [
          { type: 'set', entity: 'gateway', key: 'sessions', value: sessions },
          { type: 'set', entity: 'gateway', key: 'simulations', value: simulations },
          { type: 'set', entity: 'gateway', key: 'counter', value: counter },
        ],
      };
    }

    // --- Simulations -----------------------------------------------------
    if (method === 'GET' && path === '/api/v1/simulations') {
      return {
        response: this.json(200, { simulations: Object.keys(this.getSimulations(state)) }),
        mutations: [],
      };
    }

    // --- Environment reset ----------------------------------------------
    if (method === 'POST' && path === '/api/v1/environment/reset') {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const targets = (body.targets as string[] | undefined) ?? [];
      for (const t of targets) {
        if (!KNOWN_RESET_TARGETS.includes(t as (typeof KNOWN_RESET_TARGETS)[number])) {
          return {
            response: this.json(400, { error: `unknown reset target "${t}"`, allowed: [...KNOWN_RESET_TARGETS] }),
            mutations: [],
          };
        }
      }
      const flushAll = targets.length === 0;
      const doSessions = flushAll || targets.includes('sessions');
      const sessionCount = Object.keys(this.getSessions(state)).length;

      const result: Record<string, { flushed: boolean; count: number }> = {
        sessions: { flushed: doSessions, count: doSessions ? sessionCount : 0 },
        queues: { flushed: flushAll || targets.includes('queues'), count: 0 },
        maps: { flushed: flushAll || targets.includes('maps'), count: 0 },
        pubsub: { flushed: flushAll || targets.includes('pubsub'), count: 0 },
      };

      const mutations: StateMutation[] = [];
      if (doSessions) {
        mutations.push({ type: 'set', entity: 'gateway', key: 'sessions', value: {} });
        mutations.push({ type: 'set', entity: 'gateway', key: 'simulations', value: {} });
      }

      return { response: this.json(200, result), mutations };
    }

    // --- Replay (twin-driven trajectory for the app UI / SSE clients) ----
    if (method === 'GET' && path === '/api/v1/replay') {
      return { response: this.json(200, this.buildReplay(state, req.query)), mutations: [] };
    }

    // --- Fallback --------------------------------------------------------
    return {
      response: this.json(404, { error: 'Not found', path }),
      mutations: [],
    };
  }

  describeCapabilities(): string[] {
    return ['rateLimits'];
  }
}
