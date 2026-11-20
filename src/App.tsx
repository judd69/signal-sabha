import { useEffect, useMemo, useState } from 'react';
import MapView from './components/MapView';
import NegotiationPanel from './components/NegotiationPanel';
import ReasoningLog, { type LogEntry } from './components/ReasoningLog';
import CitizenView from './components/CitizenView';
import OperatorPanel from './components/OperatorPanel';
import { JUNCTION, VALIDATED_CORRIDORS } from './data/corridors';
import { computeCorridorState, formatClock } from './engine/congestion';
import { negotiate, type IncidentState } from './engine/negotiator';
import { hasGeminiKey } from './agents/gemini';

const HONESTY =
  'SIMULATED demo — no live feed. Corridor geometry: ESTIMATED, OSRM/OSM, 27 Oct 2026. Not affiliated with BMC / Traffic Police. No forecast.';

type Tab = 'negotiate' | 'citizen' | 'operator';

export default function App() {
  // Simulated clock starts at 08:30, the morning build-up. 1 tick = 1 sim minute.
  const [minute, setMinute] = useState(510);
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<Tab>('negotiate');
  const [incident, setIncident] = useState<IncidentState>({
    active: false,
    acknowledged: false,
    corridorId: 'sclr',
    label: 'Breakdown on SCLR East approach, near Vakola',
  });
  const [log, setLog] = useState<LogEntry[]>([
    {
      time: formatClock(510),
      agent: 'System',
      text: 'Signal Sabha started at WEH × SCLR. Three agents online. Local deterministic negotiator running — no Gemini key configured, demo fully offline.',
      kind: 'system',
    },
  ]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setMinute((m) => (m + 1) % 1440), 2500);
    return () => window.clearInterval(id);
  }, [playing]);

  const states = useMemo(() => {
    const out: Record<string, ReturnType<typeof computeCorridorState>> = {};
    VALIDATED_CORRIDORS.forEach((c, i) => {
      const load = incident.active && incident.corridorId === c.id ? (incident.acknowledged ? 0.09 : 0.18) : 0;
      out[c.id] = computeCorridorState(c, i + 1, minute, load);
    });
    return out;
  }, [minute, incident]);

  const negotiation = useMemo(() => negotiate(minute, incident), [minute, incident]);

  const pushLog = (entries: LogEntry[]) => setLog((prev) => [...prev, ...entries].slice(-40));

  const runRound = () => {
    const nextMinute = minute + 5;
    setMinute(nextMinute);
    const n = negotiate(nextMinute, incident);
    pushLog(
      n.rounds[2].lines.map((line, i) => ({
        time: formatClock(nextMinute),
        agent: ['Agent WEH–North', 'Agent WEH–South', 'Agent SCLR–East'][i] ?? 'Mediator',
        text: line,
        kind: 'negotiation' as const,
      })),
    );
  };

  const simulateIncident = () => {
    const inc: IncidentState = { active: true, acknowledged: false, corridorId: 'sclr', label: 'Breakdown on SCLR East approach, near Vakola' };
    setIncident(inc);
    pushLog([
      {
        time: formatClock(minute),
        agent: 'System',
        text: 'SIMULATED incident: breakdown on SCLR East approach. Incident load +18 pts on SCLR; its agent asks for more green next round.',
        kind: 'incident',
      },
    ]);
  };

  const acknowledgeIncident = () => {
    setIncident((prev) => ({ ...prev, acknowledged: true }));
    pushLog([
      {
        time: formatClock(minute),
        agent: 'Operator',
        text: 'Incident acknowledged — response dispatched in the model. Incident load halves (+18 → +9 pts); negotiation re-runs on the new numbers.',
        kind: 'incident',
      },
    ]);
  };

  const resolveIncident = () => {
    setIncident((prev) => ({ ...prev, active: false, acknowledged: false }));
    pushLog([
      {
        time: formatClock(minute),
        agent: 'Operator',
        text: 'Incident resolved in the model. SCLR load returns to 0; the split returns to the demand-based baseline.',
        kind: 'incident',
      },
    ]);
  };

  return (
    <div className="app">
      <div className="honesty-bar" role="note">
        {HONESTY}
      </div>
      <header className="header">
        <div>
          <h1>Signal Sabha</h1>
          <p className="tagline">
            Gemini agents negotiate green time at {JUNCTION.name} — in the open, on Mumbai Flow’s validated data.
          </p>
        </div>
        <div className="header-badges">
          <span className="badge">Team Nexora · Startup Buildathon 2026, Mumbai</span>
          <span className={hasGeminiKey() ? 'badge ok' : 'badge'}>{hasGeminiKey() ? 'Gemini connected' : 'Local negotiator · no key needed'}</span>
        </div>
      </header>

      <div className="sim-bar">
        <span>
          Simulated clock: <strong>{formatClock(minute)} IST</strong>
        </span>
        <button className="btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause clock' : 'Play clock'}
        </button>
        <button className="btn primary" onClick={runRound}>
          Run a negotiation round (+5 min)
        </button>
        <span className="muted">Agreed split now: WEH North {negotiation.agreed['weh-north']}s · WEH South {negotiation.agreed['weh-south']}s · SCLR East {negotiation.agreed['sclr-east']}s of {negotiation.cycleSeconds}s</span>
      </div>

      <MapView states={states} />

      <nav className="tabs" aria-label="Views">
        {(
          [
            ['negotiate', 'Negotiate'],
            ['citizen', 'Citizen'],
            ['operator', 'Operator'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} className={tab === id ? 'tab active' : 'tab'} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'negotiate' && (
        <>
          <NegotiationPanel negotiation={negotiation} />
          <ReasoningLog log={log} insights={negotiation.insights} />
        </>
      )}
      {tab === 'citizen' && <CitizenView />}
      {tab === 'operator' && (
        <OperatorPanel
          states={states}
          negotiation={negotiation}
          incident={incident}
          onSimulateIncident={simulateIncident}
          onAcknowledge={acknowledgeIncident}
          onResolve={resolveIncident}
        />
      )}

      <footer className="footer">
        <p>{HONESTY}</p>
        <p>
          Data layer: Mumbai Flow (Qasim Jethwa) — 6 validated corridors, geometry ESTIMATED via OSRM/OpenStreetMap,
          27 Oct 2026, ODbL 1.0. Rejected corridors (JVLR, Sea Link, Sion–Panvel) are excluded. Rule engine, not ML.
          Forecast: none — 0 eligible trips, needs 300 observations over 14 days. Signal Sabha is the Gemini agent
          layer built on top for today’s buildathon.
        </p>
      </footer>
    </div>
  );
}
