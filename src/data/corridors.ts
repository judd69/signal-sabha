/**
 * Validated corridors — the ONLY corridors Signal Sabha may use.
 *
 * Source: Mumbai Flow `public/data/real/corridors.geojson` (copied verbatim into
 * this app's `public/data/real/`), retrieved 27 Oct 2026.
 * Geometry + free-flow durations are ESTIMATED via OSRM routing on
 * OpenStreetMap. Road data © OpenStreetMap contributors, ODbL 1.0.
 *
 * Durations below are the GeoJSON `freeFlowDurationS` values (free-flow, no
 * traffic). They differ from Mumbai Flow's hand-placed reference minutes in
 * `src/data/reference/corridors.json` — those minutes are simulation
 * assumptions, these seconds are the OSRM estimates, so these win.
 *
 * REJECTED corridors — NEVER shown as validated:
 *   JVLR (75% of waypoints within 500 m), Bandra–Worli Sea Link (20%),
 *   Sion–Panvel Highway (71%). They are not in corridors.geojson at all.
 */

export type ProvenanceKind = 'OBSERVED' | 'ESTIMATED' | 'FORECAST' | 'SIMULATED';

export interface Corridor {
  id: string;
  name: string;
  shortName: string;
  routeCode: string;
  from: string;
  to: string;
  lengthKm: number;
  /** Free-flow duration in seconds, ESTIMATED (OSRM, no traffic). */
  freeFlowDurationS: number;
  /** Simulation-only base load, from Mumbai Flow's reference data. */
  baseLoad: number;
  peakBias: 'both' | 'am' | 'pm';
  alternateId?: string;
}

export const VALIDATED_CORRIDORS: Corridor[] = [
  { id: 'weh', name: 'Western Express Highway', shortName: 'WEH', routeCode: 'L12', from: 'Bandra (Kalanagar)', to: 'Dahisar', lengthKm: 27.57, freeFlowDurationS: 1689, baseLoad: 0.57, peakBias: 'both', alternateId: 'svr' },
  { id: 'svr', name: 'S.V. Road', shortName: 'SV Rd', routeCode: 'L14', from: 'Bandra', to: 'Borivali', lengthKm: 26.14, freeFlowDurationS: 2406, baseLoad: 0.55, peakBias: 'both', alternateId: 'weh' },
  { id: 'eeh', name: 'Eastern Express Highway', shortName: 'EEH', routeCode: 'L15', from: 'Sion', to: 'Thane', lengthKm: 29.06, freeFlowDurationS: 2790, baseLoad: 0.58, peakBias: 'both', alternateId: 'lbs' },
  { id: 'lbs', name: 'LBS Marg', shortName: 'LBS', routeCode: 'L24', from: 'Kurla', to: 'Mulund', lengthKm: 20.03, freeFlowDurationS: 1870, baseLoad: 0.6, peakBias: 'both', alternateId: 'eeh' },
  { id: 'sclr', name: 'Santacruz–Chembur Link Road', shortName: 'SCLR', routeCode: 'L21', from: 'Vakola', to: 'Chembur', lengthKm: 6.47, freeFlowDurationS: 410, baseLoad: 0.5, peakBias: 'both' },
  { id: 'dadar-south', name: 'Dr. Annie Besant Rd / Tulsi Pipe Rd', shortName: 'Annie Besant', routeCode: 'L07', from: 'Mahim', to: 'Fort', lengthKm: 17.44, freeFlowDurationS: 1405, baseLoad: 0.57, peakBias: 'am' },
];

export const REJECTED_CORRIDORS = [
  { id: 'jvlr', name: 'Jogeshwari–Vikhroli Link Road', within500m: 75 },
  { id: 'bwsl', name: 'Bandra–Worli Sea Link + Coastal Road', within500m: 20 },
  { id: 'sion-panvel', name: 'Sion–Panvel Highway', within500m: 71 },
] as const;

export const corridorById = (id: string): Corridor => {
  const c = VALIDATED_CORRIDORS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown or unvalidated corridor: ${id}`);
  return c;
};

export const freeFlowMinutes = (c: Corridor): number => Math.round(c.freeFlowDurationS / 6) / 10;

/** Hero junction: WEH × SCLR, Kalanagar / Vakola. SCLR's first GeoJSON point
 *  (19.078, 72.854) sits on WEH — the two validated corridors cross here. */
export const JUNCTION = {
  id: 'weh-x-sclr',
  name: 'WEH × SCLR — Kalanagar / Vakola',
  lat: 19.078,
  lon: 72.854,
  cycleSeconds: 120,
} as const;

/** The 6 origin–destination pairs Mumbai Flow monitors (OD pair coordinates are
 *  approximate points for real Mumbai localities). */
export interface OdPair {
  id: string;
  name: string;
  origin: string;
  destination: string;
  /** Validated corridors that cover this trip, in order. Empty = not covered. */
  corridorIds: string[];
  /** Honest note when coverage is partial or missing. */
  coverageNote?: string;
}

export const OD_PAIRS: OdPair[] = [
  { id: 'bandra-bkc', name: 'Bandra West → BKC', origin: 'Bandra West', destination: 'Bandra-Kurla Complex', corridorIds: ['weh', 'sclr'] },
  { id: 'andheri-powai', name: 'Andheri → Powai', origin: 'Andheri', destination: 'Powai', corridorIds: ['weh'] },
  { id: 'dadar-fort', name: 'Dadar → Fort / CSMT', origin: 'Dadar', destination: 'Fort / CSMT', corridorIds: ['dadar-south'] },
  { id: 'worli-nariman', name: 'Worli → Nariman Point', origin: 'Worli', destination: 'Nariman Point', corridorIds: ['dadar-south'] },
  { id: 'kurla-thane', name: 'Kurla → Thane', origin: 'Kurla', destination: 'Thane', corridorIds: ['lbs', 'eeh'] },
  {
    id: 'chembur-vashi', name: 'Chembur → Vashi', origin: 'Chembur', destination: 'Vashi', corridorIds: ['sclr'],
    coverageNote: 'No validated corridor covers Chembur → Vashi directly: Sion–Panvel Highway failed validation (71% of waypoints within 500 m) and is excluded. SCLR covers the Chembur leg only; the Vashi leg is not covered by validated data.',
  },
];
