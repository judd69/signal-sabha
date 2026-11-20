/**
 * Congestion model — adapted from Mumbai Flow's `src/engine/congestionEngine.ts`
 * (same time-of-day curves, same thresholds), reduced to what Signal Sabha
 * needs at one junction.
 *
 * EVERYTHING here is SIMULATED: a deterministic scenario model, not a
 * measurement. Corridor geometry and free-flow times are ESTIMATED
 * (OSRM/OSM, 27 Oct 2026); congestion, queue and waiting time are
 * SIMULATED scenario values. There is no live traffic feed.
 */
import type { Corridor } from '../data/corridors';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const gauss = (x: number, mu: number, sigma: number) =>
  Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));

/** Deterministic pseudo-noise in [-1, 1] for a (seed, minute) pair. */
export function noise(seed: number, minute: number): number {
  const x = Math.sin(seed * 127.1 + minute * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Time-of-day demand factor, 0.25 (night) … ~1.15 (peak).
 * Scenario assumption from Mumbai Flow: morning peak ≈ 09:30, evening ≈ 19:00.
 */
export function timeOfDayFactor(minute: number, bias: Corridor['peakBias'] = 'both'): number {
  const h = (minute / 60) % 24;
  const am = gauss(h, 9.5, 1.3) * (bias === 'pm' ? 0.75 : 1);
  const pm = gauss(h, 19, 1.6) * (bias === 'am' ? 0.75 : 1);
  const midday = gauss(h, 14, 3) * 0.45;
  return 0.25 + 0.9 * Math.max(am, pm) + midday * 0.5;
}

export interface CorridorState {
  corridorId: string;
  /** SIMULATED congestion score 0–100. */
  congestion: number;
  /** SIMULATED average speed km/h, derived from the score. */
  avgSpeedKmh: number;
  /** SIMULATED end-to-end travel minutes (free-flow + congestion). */
  travelMinutes: number;
  /** SIMULATED incident load, 0 when no active incident on this corridor. */
  incidentLoad: number;
}

export function computeCorridorState(
  corridor: Corridor,
  seed: number,
  minute: number,
  incidentLoad: number,
): CorridorState {
  const tod = timeOfDayFactor(minute, corridor.peakBias);
  const raw = corridor.baseLoad * tod + noise(seed, minute) * 0.06 + incidentLoad;
  const congestion = clamp(raw * 100, 4, 99);
  const freeSpeed = (corridor.lengthKm / (corridor.freeFlowDurationS / 60)) * 60;
  const avgSpeedKmh = Math.max(6, freeSpeed * (1 - 0.62 * (congestion / 100) ** 1.5));
  const travelMinutes = (corridor.lengthKm / avgSpeedKmh) * 60;
  return { corridorId: corridor.id, congestion, avgSpeedKmh, travelMinutes, incidentLoad };
}

export function congestionLevel(score: number): 'free' | 'moderate' | 'heavy' | 'severe' {
  if (score < 45) return 'free';
  if (score < 65) return 'moderate';
  if (score < 80) return 'heavy';
  return 'severe';
}

/** Mumbai Flow thresholds, reused verbatim: warn 68, critical 80. */
export const THRESHOLDS = { congestionWarn: 68, congestionCritical: 80 } as const;

export function formatClock(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
