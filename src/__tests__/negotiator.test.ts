import { describe, expect, it } from 'vitest';
import { negotiate, scaleToCycle, type IncidentState } from '../engine/negotiator';
import { computeCorridorState } from '../engine/congestion';
import { VALIDATED_CORRIDORS, corridorById } from '../data/corridors';

const noIncident: IncidentState = { active: false, acknowledged: false, corridorId: 'sclr', label: 'none' };
const sclrIncident: IncidentState = { active: true, acknowledged: false, corridorId: 'sclr', label: 'breakdown' };

describe('validated corridors', () => {
  it('has exactly the 6 validated corridors, and no rejected ones', () => {
    expect(VALIDATED_CORRIDORS.map((c) => c.id).sort()).toEqual(
      ['dadar-south', 'eeh', 'lbs', 'sclr', 'svr', 'weh'].sort(),
    );
    expect(() => corridorById('jvlr')).toThrow();
    expect(() => corridorById('bwsl')).toThrow();
    expect(() => corridorById('sion-panvel')).toThrow();
  });

  it('free-flow durations match the GeoJSON (ESTIMATED, OSRM)', () => {
    expect(corridorById('weh').freeFlowDurationS).toBe(1689);
    expect(corridorById('sclr').freeFlowDurationS).toBe(410);
    expect(corridorById('eeh').freeFlowDurationS).toBe(2790);
  });
});

describe('congestion model', () => {
  it('stays in bounds at morning peak and at night', () => {
    for (const minute of [570, 0, 1140]) {
      const s = computeCorridorState(corridorById('weh'), 1, minute, 0);
      expect(s.congestion).toBeGreaterThanOrEqual(4);
      expect(s.congestion).toBeLessThanOrEqual(99);
      expect(s.avgSpeedKmh).toBeGreaterThan(0);
      expect(s.travelMinutes).toBeGreaterThan(0);
    }
  });

  it('an incident raises congestion on its corridor only', () => {
    const base = computeCorridorState(corridorById('sclr'), 3, 570, 0);
    const hit = computeCorridorState(corridorById('sclr'), 3, 570, 0.18);
    const other = computeCorridorState(corridorById('weh'), 1, 570, 0);
    expect(hit.congestion).toBeGreaterThan(base.congestion);
    expect(other.congestion).toBeLessThanOrEqual(99);
  });
});

describe('negotiator', () => {
  it('the agreed split always sums to the 120s cycle, with a 15s floor each', () => {
    for (const minute of [480, 570, 600, 1140]) {
      const n = negotiate(minute, noIncident);
      const total = Object.values(n.agreed).reduce((s, v) => s + v, 0);
      expect(total).toBe(120);
      Object.values(n.agreed).forEach((v) => expect(v).toBeGreaterThanOrEqual(15));
      expect(n.rounds).toHaveLength(3);
      expect(n.insights.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('scaleToCycle fits an over-asking round and keeps the floor', () => {
    const scaled = scaleToCycle({ 'weh-north': 70, 'weh-south': 60, 'sclr-east': 50 }, 120);
    expect(Object.values(scaled).reduce((s, v) => s + v, 0)).toBe(120);
    Object.values(scaled).forEach((v) => expect(v).toBeGreaterThanOrEqual(15));
  });

  it('a SCLR incident grows the SCLR share versus no incident', () => {
    const base = negotiate(570, noIncident);
    const hit = negotiate(570, sclrIncident);
    expect(hit.agreed['sclr-east']).toBeGreaterThanOrEqual(base.agreed['sclr-east']);
    expect(hit.insights.some((i) => i.kind === 'incident')).toBe(true);
  });

  it('every insight carries metric, reason and action', () => {
    const n = negotiate(570, sclrIncident);
    n.insights.forEach((i) => {
      expect(i.metric.length).toBeGreaterThan(10);
      expect(i.reason.length).toBeGreaterThan(10);
      expect(i.action.length).toBeGreaterThan(5);
    });
  });
});
