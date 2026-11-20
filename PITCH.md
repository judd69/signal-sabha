# Signal Sabha — Pitch Outline (1 page)

## The problem, lived in Mumbai

Every Mumbaikar knows the WEH × SCLR junction at Kalanagar: three streams of traffic arrive at
once, the light gives one of them too little green, and nobody can say why. Signal timings are
set, tweaked, and forgotten — the reasoning behind a green split is invisible to the people
waiting at the light and to the officers who run it. We have all sat in that queue wondering
who decided this.

## One user

**The ward traffic officer on morning duty at Kalanagar** — and, through the citizen view, the
commuter behind them. The officer needs a split they can defend in one sentence; the commuter
needs to know when to leave and why their light stayed red.

## The product (live demo, not slides)

Signal Sabha puts three Gemini agents at one junction — WEH North, WEH South, SCLR East — and
lets them negotiate the 120-second green cycle in the open:

1. **Map:** 6 validated Mumbai corridors drawn from real OSRM/OpenStreetMap geometry (27 Oct 2026).
   The 3 corridors that failed validation (JVLR, Sea Link, Sion–Panvel) are excluded on purpose.
2. **Negotiation:** Round 1 proposals, Round 2 mediator counter-proposals with a 15-second fairness
   floor, Round 3 agreed split — every step in plain language.
3. **Reasoning Log:** every decision publishes its metric, why it fired, and what to do. A citizen
   can read exactly why their approach got 28 seconds and not 45.
4. **Incident:** simulate a breakdown on SCLR and watch its agent ask for more green; acknowledge
   it and the load halves. In-browser only, resets on reload — we say so.
5. **Citizen view:** Hinglish/Marathi, "Bandra → BKC by 9:30" → leave-by time and route, with
   free-flow times labelled ESTIMATED and delays labelled SIMULATED.

## What we do NOT claim (say this before a juror asks)

No live traffic feed, no live GPS, no forecast model (0 eligible trips — the pipeline needs 300
observations over 14 days), and no affiliation with BMC, BEST, MMRDA or Mumbai Traffic Police.
Congestion, queue and waiting times in the demo are SIMULATED scenario values from Mumbai Flow's
transparent rule engine — not a trained ML model, and we show the rules. The credibility is the
validation: a system that only confirms what you believe isn't measuring anything, which is why
the three failed corridors are the proof the six that passed can be trusted.

## Who pays (B2G)

A BMC ward / Traffic Police **pilot**: one junction, one corridor pair, measured against the
current fixed-time plan for 30 days. The buyer is the city, not the commuter — the citizen view
is free and is what makes the system auditable. Priced as a pilot + per-junction licence after
the pilot proves a queue-time reduction on measured (not simulated) data.

## Why us / why now

Mumbai Flow is already a working command-centre prototype with validated corridor geometry;
Signal Sabha is the agent layer it was built to carry. The judging criteria reward exactly this
shape: a clear problem, a working product, a real market with a named payer, scalable
architecture, and deep Google AI use — Gemini agents with a rule engine they can audit, not a
black box.

## What we need next

- A pilot junction and 30 days of measured operator journey times (the only ML-eligible data
  source — none exists yet) so the forecast pipeline can train honestly.
- Access to a GTFS / GTFS-Realtime feed when a verified Mumbai feed exists.
- A mentor intro to a ward officer willing to run the one-junction pilot.

**Close:** "The light stayed red for a reason today — and for the first time, you can read the reason."
