import { VALIDATED_CORRIDORS } from '../data/corridors';
import { congestionLevel, type CorridorState } from '../engine/congestion';
import type { IncidentState, Negotiation } from '../engine/negotiator';

interface Props {
  states: Record<string, CorridorState>;
  negotiation: Negotiation;
  incident: IncidentState;
  onSimulateIncident: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
}

export default function OperatorPanel({ states, negotiation, incident, onSimulateIncident, onAcknowledge, onResolve }: Props) {
  return (
    <section className="panel">
      <h2>Operator dashboard — WEH × SCLR junction</h2>
      <p className="panel-sub">
        What a ward officer would watch: queue, green split, congestion per corridor. Everything here runs in the
        browser only and resets on reload — say so out loud in the demo.
      </p>
      <table className="ops-table">
        <thead>
          <tr>
            <th>Corridor</th>
            <th>Congestion (SIMULATED)</th>
            <th>Speed</th>
            <th>Travel now</th>
            <th>Free-flow (ESTIMATED)</th>
          </tr>
        </thead>
        <tbody>
          {VALIDATED_CORRIDORS.map((c) => {
            const s = states[c.id];
            if (!s) return null;
            return (
              <tr key={c.id}>
                <td>
                  {c.shortName} <span className="muted">({c.routeCode})</span>
                </td>
                <td>
                  <span className={`level level-${congestionLevel(s.congestion)}`}>
                    {s.congestion.toFixed(0)}/100 · {congestionLevel(s.congestion)}
                  </span>
                </td>
                <td>{s.avgSpeedKmh.toFixed(0)} km/h</td>
                <td>{s.travelMinutes.toFixed(0)} min</td>
                <td>{(c.freeFlowDurationS / 60).toFixed(1)} min</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Live split at the junction</h3>
      <p>
        {Object.entries(negotiation.agreed)
          .map(([id, secs]) => `${id === 'weh-north' ? 'WEH North' : id === 'weh-south' ? 'WEH South' : 'SCLR East'}: ${secs}s`)
          .join(' · ')}{' '}
        of a {negotiation.cycleSeconds}s cycle.
      </p>
      <h3>Incident control (simulated)</h3>
      {!incident.active && (
        <button className="btn danger" onClick={onSimulateIncident}>
          Simulate incident — breakdown on SCLR approach
        </button>
      )}
      {incident.active && !incident.acknowledged && (
        <div className="incident-box">
          <p>
            <strong>Incident:</strong> {incident.label}. SCLR queue is rising; its agent is asking for more green.
          </p>
          <button className="btn" onClick={onAcknowledge}>
            Acknowledge — dispatch response (halves incident load in the model)
          </button>
        </div>
      )}
      {incident.active && incident.acknowledged && (
        <div className="incident-box">
          <p>
            <strong>Acknowledged.</strong> Response dispatched in the model; incident load halved. Queue should ease
            over the next rounds.
          </p>
          <button className="btn" onClick={onResolve}>
            Resolve incident
          </button>
        </div>
      )}
      <p className="note">
        Incident changes live in browser memory only and reset on reload. No real incident feed exists — Mumbai Flow
        has no accessible source for official Traffic Police notices.
      </p>
    </section>
  );
}
