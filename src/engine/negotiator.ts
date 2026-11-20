/**
 * Signal Sabha negotiator — the agent layer on top of Mumbai Flow.
 *
 * Three agents, one per approach at WEH × SCLR, negotiate the green split of
 * a fixed 120-second cycle. This is the deterministic LOCAL negotiator: it
 * runs fully offline, uses only the transparent rule engine, and is what the
 * demo uses when no Gemini API key is present. A Gemini call (see
 * `src/agents/gemini.ts`) may *justify* a split in words — it never changes
 * the numbers, so the demo can never break on a missing key or a bad reply.
 *
 * Protocol (3 rounds, all visible in the UI):
 *   Round 1 — Proposals: each agent asks for green in proportion to its own
 *     demand (congestion × queue). Selfish asks; the sum usually exceeds 120 s.
 *   Round 2 — Counter-proposals: a mediator scales every ask to fit the
 *     cycle, with a fairness floor of 15 s per approach (nobody gets starved).
 *   Round 3 — Agreed: the scaled split is adopted, and each agent states in
 *     plain language why it accepted (or what it gave up).
 *
 * Every decision is published as an Insight — the same shape as Mumbai
 * Flow's `Insight[]`: metric, why it fired, recommendation, priority.
 * Provenance: congestion/queue/waiting are SIMULATED; corridor geometry and
 * free-flow times are ESTIMATED (OSRM/OSM, 27 Oct 2026).
 */
import { JUNCTION, corridorById } from '../data/corridors';
import {
  computeCorridorState,
  congestionLevel,
  noise,
  THRESHOLDS,
  type CorridorState,
} from './congestion';

export interface Insight {
  id: string;
  kind: 'congestion' | 'negotiation' | 'incident' | 'citizen';
  title: string;
  subject: string;
  /** The observed number, with its provenance in plain words. */
  metric: string;
  /** Why the rule fired. */
  reason: string;
  /** What to consider doing. */
  action: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: number;
}

export interface Approach {
  id: 'weh-north' | 'weh-south' | 'sclr-east';
  agentName: string;
  /** What this agent speaks for, in plain words. */
  approachName: string;
  corridorId: string;
  seed: number;
}

export const APPROACHES: Approach[] = [
  { id: 'weh-north', agentName: 'Agent WEH–North', approachName: 'WEH Northbound — from Bandra / Kalanagar', corridorId: 'weh', seed: 11 },
  { id: 'weh-south', agentName: 'Agent WEH–South', approachName: 'WEH Southbound — from Andheri / Jogeshwari', corridorId: 'weh', seed: 23 },
  { id: 'sclr-east', agentName: 'Agent SCLR–East', approachName: 'SCLR Eastbound — from Vakola towards Chembur', corridorId: 'sclr', seed: 37 },
];

export interface ApproachDemand {
  approach: Approach;
  state: CorridorState;
  /** SIMULATED vehicles queued at the stop line. */
  queueVehicles: number;
  /** SIMULATED average wait at the stop line, minutes. */
  waitMinutes: number;
  /** Demand weight the negotiation uses. */
  demand: number;
}

export interface NegotiationRound {
  round: 1 | 2 | 3;
  label: string;
  /** Green seconds per approach in this round. */
  split: Record<Approach['id'], number>;
  /** Plain-language explanation, one line per approach. */
  lines: string[];
}

export interface Negotiation {
  minute: number;
  cycleSeconds: number;
  demands: ApproachDemand[];
  rounds: NegotiationRound[];
  agreed: Record<Approach['id'], number>;
  insights: Insight[];
}

export interface IncidentState {
  active: boolean;
  acknowledged: boolean;
  /** Which corridor the simulated incident sits on. */
  corridorId: 'sclr' | 'weh';
  label: string;
}

export function incidentLoadFor(corridorId: string, incident: IncidentState): number {
  if (!incident.active) return 0;
  if (incident.corridorId !== corridorId) return 0;
  // Acknowledging an incident does not clear it, but the response (crew
  // dispatched, one lane kept moving) halves its load on the model.
  return incident.acknowledged ? 0.09 : 0.18;
}

function demandFor(a: Approach, minute: number, incident: IncidentState): ApproachDemand {
  const corridor = corridorById(a.corridorId);
  const state = computeCorridorState(corridor, a.seed, minute, incidentLoadFor(a.corridorId, incident));
  const queueVehicles = Math.max(
    2,
    Math.round(6 + state.congestion * 0.32 + noise(a.seed + 5, minute) * 4 + (incident.active && incident.corridorId === a.corridorId ? 16 : 0)),
  );
  const waitMinutes = Math.max(0.5, Math.round((queueVehicles * 0.45 + state.congestion * 0.04) * 10) / 10);
  // Demand = congestion share × queue. Congestion is the shared corridor
  // signal; queue is what makes the two WEH approaches differ.
  const demand = state.congestion * (0.6 + queueVehicles / 40);
  return { approach: a, state, queueVehicles, waitMinutes, demand };
}

/** Scale raw asks to fit the cycle, keeping a 15 s fairness floor each. */
export function scaleToCycle(
  asks: Record<Approach['id'], number>,
  cycleSeconds: number,
): Record<Approach['id'], number> {
  const floor = 15;
  const ids = Object.keys(asks) as Approach['id'][];
  const totalAsk = ids.reduce((s, id) => s + asks[id], 0);
  if (totalAsk <= cycleSeconds) return { ...asks };
  // First pass: proportional scale, then enforce the floor and re-balance.
  let scaled: Record<string, number> = {};
  ids.forEach((id) => (scaled[id] = Math.max(floor, Math.round((asks[id] / totalAsk) * cycleSeconds))));
  let total = ids.reduce((s, id) => s + scaled[id], 0);
  // Trim the largest share until we fit; never below the floor.
  while (total > cycleSeconds) {
    const biggest = ids.reduce((a, b) => (scaled[a] >= scaled[b] ? a : b));
    if (scaled[biggest] <= floor) break;
    scaled[biggest] -= 1;
    total -= 1;
  }
  // Hand the leftover seconds to the approach with the largest ask.
  while (total < cycleSeconds) {
    const biggest = ids.reduce((a, b) => (asks[a] >= asks[b] ? a : b));
    scaled[biggest] += 1;
    total += 1;
  }
  return scaled as Record<Approach['id'], number>;
}

export function negotiate(minute: number, incident: IncidentState): Negotiation {
  const cycle = JUNCTION.cycleSeconds;
  const demands = APPROACHES.map((a) => demandFor(a, minute, incident));
  const totalDemand = demands.reduce((s, d) => s + d.demand, 0);

  // Round 1 — selfish proposals, proportional to demand, uncapped.
  const asks = {} as Record<Approach['id'], number>;
  demands.forEach((d) => {
    asks[d.approach.id] = Math.round((d.demand / totalDemand) * cycle * 1.25);
  });
  const round1Lines = demands.map(
    (d) =>
      `${d.approach.agentName} asks ${asks[d.approach.id]}s: congestion ${d.state.congestion.toFixed(0)}/100 (SIMULATED), ${d.queueVehicles} vehicles queued, ~${d.waitMinutes} min wait.`,
  );

  // Round 2 — mediator counters: scale to the 120 s cycle, floor 15 s.
  const counter = scaleToCycle(asks, cycle);
  const round2Lines = demands.map((d) => {
    const giveUp = asks[d.approach.id] - counter[d.approach.id];
    return giveUp > 0
      ? `${d.approach.agentName} counters at ${counter[d.approach.id]}s — gives up ${giveUp}s so the cycle fits ${cycle}s, keeps the 15s fairness floor.`
      : `${d.approach.agentName} holds at ${counter[d.approach.id]}s — its ask already fit.`;
  });

  // Round 3 — agreed.
  const agreed = { ...counter };
  const round3Lines = demands.map(
    (d) =>
      `${d.approach.agentName} accepts ${agreed[d.approach.id]}s green. ${d.state.congestion >= THRESHOLDS.congestionWarn ? 'Congestion is above the 68 threshold, so this approach stays the priority next round.' : 'Congestion is below the 68 threshold, so it can afford to wait next round.'}`,
  );

  const insights: Insight[] = demands.map((d) => {
    const level = congestionLevel(d.state.congestion);
    return {
      id: `neg-${d.approach.id}`,
      kind: 'negotiation',
      title: `${d.approach.approachName}: ${agreed[d.approach.id]}s green agreed`,
      subject: `${corridorById(d.approach.corridorId).name} (${corridorById(d.approach.corridorId).routeCode})`,
      metric: `Congestion ${d.state.congestion.toFixed(0)}/100 (${level}, SIMULATED) · queue ${d.queueVehicles} vehicles · wait ~${d.waitMinutes} min · green ${agreed[d.approach.id]}s of ${cycle}s`,
      reason: `Demand weight ${d.demand.toFixed(0)} came from simulated congestion ${d.state.congestion.toFixed(0)} and a simulated queue of ${d.queueVehicles}. Round 1 asked ${asks[d.approach.id]}s; the mediator scaled it to ${agreed[d.approach.id]}s to fit the ${cycle}s cycle with a 15s floor.`,
      action:
        d.state.congestion >= THRESHOLDS.congestionCritical
          ? 'Critical: hold this split for the next two cycles and post a delay advisory for this approach.'
          : d.state.congestion >= THRESHOLDS.congestionWarn
            ? 'Review again next round; if the queue is still growing, extend green by up to 10s from the lightest approach.'
            : 'No action — revisit next round.',
      severity: d.state.congestion >= THRESHOLDS.congestionCritical ? 'critical' : d.state.congestion >= THRESHOLDS.congestionWarn ? 'high' : 'medium',
      priority: Math.round(d.state.congestion * 0.8),
    };
  });
  if (incident.active) {
    insights.unshift({
      id: 'incident-sclr',
      kind: 'incident',
      title: incident.acknowledged ? 'Incident acknowledged — response under way' : 'Simulated incident on SCLR approach',
      subject: incident.label,
      metric: `Incident load +${(incidentLoadFor(incident.corridorId, incident) * 100).toFixed(0)} congestion pts (SIMULATED) · SCLR queue rises, its agent asks for more green.`,
      reason: incident.acknowledged
        ? 'Acknowledging dispatches a response in the model, halving the incident load from +18 to +9 pts — the negotiation re-runs on the new numbers.'
        : 'An unacknowledged incident keeps its full +18 pts load in the model, so the SCLR agent’s demand — and its green ask — rise.',
      action: incident.acknowledged ? 'Monitor the queue; resolve the incident when the queue falls below 15 vehicles.' : 'Acknowledge the incident to dispatch a response and cut its load in half.',
      severity: incident.acknowledged ? 'medium' : 'high',
      priority: 85,
    });
  }

  return {
    minute,
    cycleSeconds: cycle,
    demands,
    rounds: [
      { round: 1, label: 'Round 1 — Proposals', split: asks, lines: round1Lines },
      { round: 2, label: 'Round 2 — Counter-proposals', split: counter, lines: round2Lines },
      { round: 3, label: 'Round 3 — Agreed split', split: agreed, lines: round3Lines },
    ],
    agreed,
    insights,
  };
}
