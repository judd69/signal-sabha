import { useMemo, useState } from 'react';
import { OD_PAIRS, corridorById, freeFlowMinutes } from '../data/corridors';
import { computeCorridorState, formatClock } from '../engine/congestion';

type Lang = 'en' | 'hi' | 'mr';

const STRINGS: Record<Lang, { title: string; leaveBy: string; route: string; expect: string; freeFlow: string; simulatedDelay: string }> = {
  en: {
    title: 'Citizen view — plan my trip',
    leaveBy: 'Leave by',
    route: 'Route',
    expect: 'What to expect',
    freeFlow: 'free-flow, ESTIMATED (OSRM)',
    simulatedDelay: 'SIMULATED congestion delay at 09:30',
  },
  hi: {
    title: 'Nagrik view — meri yatra plan karo',
    leaveBy: 'Nikalne ka time',
    route: 'Rasta',
    expect: 'Kya expect karein',
    freeFlow: 'free-flow, ESTIMATED (OSRM)',
    simulatedDelay: '09:30 par SIMULATED congestion delay',
  },
  mr: {
    title: 'Nagrik drushtikon — maza pravas niyojit kara',
    leaveBy: 'Nighanyachi vel',
    route: 'Marg',
    expect: 'Kay apeksha karavi',
    freeFlow: 'free-flow, ESTIMATED (OSRM)',
    simulatedDelay: '09:30 la SIMULATED congestion delay',
  },
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export default function CitizenView() {
  const [lang, setLang] = useState<Lang>('en');
  const [odId, setOdId] = useState('bandra-bkc');
  const [target, setTarget] = useState('09:30');
  const t = STRINGS[lang];
  const od = OD_PAIRS.find((o) => o.id === odId) ?? OD_PAIRS[0];

  const plan = useMemo(() => {
    // Congestion at the 09:30 morning peak (minute 570), SIMULATED.
    const peakMinute = 570;
    const legs = od.corridorIds.map((id) => {
      const c = corridorById(id);
      const state = computeCorridorState(c, 11, peakMinute, 0);
      return {
        corridor: c,
        freeFlow: freeFlowMinutes(c),
        simulated: Math.max(0, Math.round((state.travelMinutes - freeFlowMinutes(c)) * 10) / 10),
        total: Math.round(state.travelMinutes * 10) / 10,
      };
    });
    const freeFlowTotal = legs.reduce((s, l) => s + l.freeFlow, 0);
    const total = legs.reduce((s, l) => s + l.total, 0);
    const leaveBy = formatClock(toMinutes(target) - Math.round(total));
    return { legs, freeFlowTotal, total, leaveBy };
  }, [od, target]);

  return (
    <section className="panel">
      <h2>{t.title}</h2>
      <p className="panel-sub">
        “I need to reach BKC from Bandra by 9:30” — answered in plain language. Free-flow times are ESTIMATED
        (OSRM/OSM, 27 Oct 2026); the extra delay is SIMULATED at the 09:30 peak. Nothing here is a live prediction.
      </p>
      <div className="lang-toggle" role="group" aria-label="Language">
        {(['en', 'hi', 'mr'] as Lang[]).map((l) => (
          <button key={l} className={lang === l ? 'tab active' : 'tab'} onClick={() => setLang(l)}>
            {l === 'en' ? 'English' : l === 'hi' ? 'Hinglish' : 'मराठी'}
          </button>
        ))}
      </div>
      <div className="form-row">
        <label>
          From → To
          <select value={odId} onChange={(e) => setOdId(e.target.value)}>
            {OD_PAIRS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reach by
          <input type="time" value={target} onChange={(e) => setTarget(e.target.value || '09:30')} />
        </label>
      </div>
      <div className="plan-card">
        <p>
          <strong>{t.leaveBy}: {plan.leaveBy} IST</strong> — to reach {od.destination} by {target}.
        </p>
        <p>
          <strong>{t.route}:</strong>{' '}
          {plan.legs.map((l) => `${l.corridor.shortName} (${l.total} min)`).join(' → ')}
        </p>
        <p>
          {plan.freeFlowTotal.toFixed(1)} min {t.freeFlow} +{' '}
          {(plan.total - plan.freeFlowTotal).toFixed(1)} min {t.simulatedDelay} ={' '}
          <strong>{plan.total.toFixed(1)} min total (SIMULATED).</strong>
        </p>
        <p>
          <strong>{t.expect}:</strong>{' '}
          {plan.total - plan.freeFlowTotal > 10
            ? 'Heavy morning peak on this route — the junction agents are giving the busy approach more green. Leave on time; the delay is the scenario model, not a live measurement.'
            : 'Morning peak is manageable on this route in the scenario model. Still leave by the time above — these are estimates, not a guarantee.'}
        </p>
        {od.coverageNote && <p className="warning">⚠ {od.coverageNote}</p>}
      </div>
    </section>
  );
}
