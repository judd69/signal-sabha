import type { Insight } from '../engine/negotiator';

export interface LogEntry {
  time: string;
  agent: string;
  text: string;
  kind: 'negotiation' | 'incident' | 'system';
}

/** The public reasoning log: every decision, with its metric and its reason. */
export default function ReasoningLog({ log, insights }: { log: LogEntry[]; insights: Insight[] }) {
  return (
    <section className="panel">
      <h2>Reasoning Log — published in the open</h2>
      <p className="panel-sub">
        Every decision shows the metric, why it fired, and what to do. This is the transparency layer: a citizen
        can read exactly why their light stayed red.
      </p>
      <ol className="log-list">
        {log.map((entry, i) => (
          <li key={i} className="log-entry">
            <span className="log-time">{entry.time} IST</span>
            <span className="log-agent">{entry.agent}</span>
            <span className="log-text">{entry.text}</span>
          </li>
        ))}
        {log.length === 0 && <li className="log-entry">No rounds run yet — press “Run a negotiation round”.</li>}
      </ol>
      <h3>Current insights</h3>
      <div className="insights">
        {insights.map((ins) => (
          <article key={ins.id} className={`insight sev-${ins.severity}`}>
            <header>
              <strong>{ins.title}</strong>
              <span className="badge">Priority {ins.priority}</span>
            </header>
            <p>
              <span className="source-tag rule">Rule engine</span> <strong>Metric:</strong> {ins.metric}
            </p>
            <p>
              <strong>Why:</strong> {ins.reason}
            </p>
            <p>
              <strong>Do:</strong> {ins.action}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
