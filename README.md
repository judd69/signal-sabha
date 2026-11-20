# Signal Sabha — Mumbai Traffic, Negotiated in the Open

**Team Nexora · Startup Buildathon 2026, Mumbai (20–21 Nov 2026)**
Gemini agents negotiate green time at one junction — WEH × SCLR, Kalanagar / Vakola —
on Mumbai Flow's validated corridor data, with every decision's reasoning published openly.

## What it is

- **One junction, end-to-end.** Three agents (WEH North, WEH South, SCLR East) negotiate a
  120-second green cycle in 3 visible rounds: proposals → counter-proposals → agreed split.
- **Real map, real geometry.** The 6 validated corridors are drawn from the real GeoJSON
  (`public/data/real/corridors.geojson`, copied verbatim from Mumbai Flow, OSRM/OSM, 27 Oct 2026).
- **Open reasoning.** Every decision is an `Insight` — metric, why it fired, recommendation,
  priority — in a public Reasoning Log with IST timestamps.
- **Citizen view.** English / Hinglish / Marathi. "Reach BKC from Bandra by 9:30" → plain-language
  plan with leave-by time, using validated corridors only.
- **Operator dashboard.** Queue, green split, congestion per corridor, and an incident control
  that changes the negotiation (browser-only, resets on reload).

## What is SIMULATED vs ESTIMATED — read this before demoing

| Value | Provenance | Meaning |
|---|---|---|
| Corridor geometry (polylines) | **ESTIMATED** — OSRM routing on OpenStreetMap, retrieved 27 Oct 2026, ODbL 1.0 | Real road geometry, routed — not surveyed. |
| Free-flow times (e.g. WEH 1689s, SCLR 410s) | **ESTIMATED** — OSRM, no traffic | Free-flow only. |
| Congestion, queue, waiting time, travel-now | **SIMULATED** | Deterministic scenario model adapted from Mumbai Flow's rule engine. Not a measurement, not live. |
| Forecast | **NONE** | No forecast model exists. 0 eligible trips; the pipeline needs 300 observations over 14 days. Do not claim one. |
| Live feed / GPS / BMC data | **NONE** | No live traffic feed, no live vehicle positions, no official Traffic Police notices. |
| Affiliation | **NONE** | Independent student prototype. NOT affiliated with BMC, BEST, MMRDA or Mumbai Traffic Police. |

**Only 6 validated corridors are used:** WEH, S.V. Road, Eastern Express Highway, LBS Marg,
SCLR, Dr Annie Besant Rd / Tulsi Pipe Rd. **Rejected and excluded:** JVLR (75%), Bandra–Worli
Sea Link (20%), Sion–Panvel (71% of waypoints within 500 m). They are not in the GeoJSON and
the app refuses them (`corridorById` throws — covered by test).

## How to run

```bash
cd signal-sabha
npm install
npm run dev        # local dev server, http://localhost:5173
npm test           # Vitest — negotiator + congestion + corridor validation
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Optional Gemini: copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY`.
Without a key the demo runs fully offline on the deterministic local negotiator — the
"Ask Gemini to justify the split" button is replaced by a note saying so. Gemini text,
when present, is labelled **Gemini-generated** and never changes the numbers.

## Deploy to GitHub Pages

```bash
# In a repo created by Jude (the team owns repo creation), e.g. judd69/signal-sabha:
npm run build
# Deploy dist/ to Pages. With GitHub Actions, set VITE_BASE_PATH=/signal-sabha/
# (the vite config reads VITE_BASE_PATH, default './' works from any sub-path).
VITE_BASE_PATH=/signal-sabha/ npm run build
```

The app uses relative asset paths and fetches `data/real/corridors.geojson` under
`import.meta.env.BASE_URL`, so it works from a project sub-path. Map tiles come from
OpenStreetMap at runtime (needs internet for the basemap only; the negotiation works offline).

## 2-minute demo script (showcase)

1. **Map (20s).** "Six validated corridors, real OSRM geometry — the three that failed
   validation are left out on purpose. Our hero junction is WEH × SCLR."
2. **Run a round (40s).** Press **Run a negotiation round**. Watch Round 1 asks exceed 120s,
   Round 2 mediator scales them with a 15s floor, Round 3 agreed. Read one reason aloud —
   congestion, queue, wait, all labelled SIMULATED.
3. **Incident (30s).** Operator tab → **Simulate incident** on SCLR. The SCLR agent's ask
   jumps. **Acknowledge** — load halves, split re-balances. Say: "in-browser only, resets on reload."
4. **Citizen (20s).** Citizen tab, Hinglish → "Bandra West → BKC, reach by 9:30" → leave-by
   time, route, free-flow ESTIMATED + SIMULATED delay. Try Chembur → Vashi to show the honest
   gap: Sion–Panvel failed validation, so that leg is not covered.
5. **Close (10s).** "No live feed, no forecast, no BMC claim. What we built is the negotiation
   protocol + the open reasoning log — the part a city can actually audit."

## Architecture

```
src/
  data/corridors.ts        6 validated corridors + OD pairs + junction (source of truth)
  engine/congestion.ts     time-of-day + deterministic congestion (adapted from Mumbai Flow)
  engine/negotiator.ts     3-round protocol, scaleToCycle, Insight[] shape
  agents/prompts.ts        Gemini system prompts (honesty rules baked in)
  agents/gemini.ts         optional Gemini hook — numbers never come from the LLM
  components/              MapView, NegotiationPanel, ReasoningLog, CitizenView, OperatorPanel
  __tests__/negotiator.test.ts   Vitest: split sums to 120s, 15s floor, incident effect, validation
public/data/real/          corridors.geojson + manifest.json (verbatim from Mumbai Flow)
```

Data layer: Mumbai Flow by Qasim Jethwa (https://qasimjethwa.github.io/Traffic-management/).
Signal Sabha is the Gemini agent layer built on top for this buildathon.
