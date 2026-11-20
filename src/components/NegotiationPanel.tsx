import { useState } from 'react';
import { APPROACHES, type Negotiation } from '../engine/negotiator';
import { agentSystemPrompt, buildJustificationPrompt } from '../agents/prompts';
import { explainWithGemini, hasGeminiKey } from '../agents/gemini';
import { formatClock } from '../engine/congestion';

function SplitBars({ split, cycle }: { split: Record<string, number>; cycle: number }) {
  return (
    <div className="split-bars">
      {APPROACHES.map((a) => {
        const seconds = split[a.id] ?? 0;
        const pct = Math.round((seconds / cycle) * 100);
        return (
          <div key={a.id} className="split-row">
            <span className="split-label">{a.agentName}</span>
            <div className="split-track">
              <div className="split-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="split-value">
              {seconds}s · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function NegotiationPanel({ negotiation }: { negotiation: Negotiation }) {
  const [round, setRound] = useState<1 | 2 | 3>(3);
  const [geminiText, setGeminiText] = useState<string | null>(null);
  const [geminiState, setGeminiState] = useState<'idle' | 'loading' | 'error'>('idle');
  const current = negotiation.rounds.find((r) => r.round === round) ?? negotiation.rounds[2];
  const geminiAvailable = hasGeminiKey();

  const askGemini = async () => {
    const sclr = negotiation.demands.find((d) => d.approach.id === 'sclr-east');
    if (!sclr) return;
    setGeminiState('loading');
    setGeminiText(null);
    try {
      const text = await explainWithGemini(
        agentSystemPrompt(sclr.approach.agentName, sclr.approach.approachName),
        buildJustificationPrompt(
          sclr.approach.agentName,
          sclr.approach.approachName,
          negotiation.agreed['sclr-east'],
          negotiation.cycleSeconds,
          sclr.state.congestion,
          sclr.queueVehicles,
          sclr.waitMinutes,
        ),
      );
      setGeminiText(text);
      setGeminiState('idle');
    } catch {
      setGeminiState('error');
    }
  };

  return (
    <section className="panel">
      <h2>Negotiation — {formatClock(negotiation.minute)} IST (simulated clock)</h2>
      <p className="panel-sub">
        Three agents, one per approach, negotiate a {negotiation.cycleSeconds}s cycle. Round 1 asks are selfish and
        usually exceed the cycle; the mediator scales them down with a 15s fairness floor. Numbers are SIMULATED;
        the protocol and the rule engine are the real product.
      </p>
      <div className="round-tabs" role="tablist" aria-label="Negotiation rounds">
        {negotiation.rounds.map((r) => (
          <button
            key={r.round}
            role="tab"
            aria-selected={round === r.round}
            className={round === r.round ? 'tab active' : 'tab'}
            onClick={() => setRound(r.round)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <SplitBars split={current.split} cycle={negotiation.cycleSeconds} />
      <ul className="reason-lines">
        {current.lines.map((line, i) => (
          <li key={i}>
            <span className="source-tag rule">Rule engine</span> {line}
          </li>
        ))}
      </ul>
      <div className="gemini-box">
        <div className="gemini-head">
          <strong>Gemini justification</strong>
          <span className={geminiAvailable ? 'badge ok' : 'badge'}>
            {geminiAvailable ? 'Gemini connected' : 'No Gemini key — local negotiator running'}
          </span>
        </div>
        {geminiAvailable ? (
          <>
            <button className="btn" onClick={askGemini} disabled={geminiState === 'loading'}>
              {geminiState === 'loading' ? 'Asking Gemini…' : 'Ask Gemini to justify the SCLR split'}
            </button>
            {geminiState === 'error' && (
              <p className="note">Gemini call failed — the agreed split above is unchanged. The rule-engine reasons still stand.</p>
            )}
            {geminiText && (
              <p className="gemini-text">
                <span className="source-tag gemini">Gemini-generated</span> {geminiText}
              </p>
            )}
          </>
        ) : (
          <p className="note">
            Set <code>VITE_GEMINI_API_KEY</code> to let Gemini justify splits in words. Without it, the demo runs
            fully offline on the deterministic local negotiator — nothing breaks, nothing is faked.
          </p>
        )}
      </div>
    </section>
  );
}
