# F1 Fantasy Development Notes

## Project shape

The repo follows the architecture described in `implementation_plan.md`:

- `scripts/fetch_season_data.py`
  - Offline FastF1 exporter.
  - Generates `src/data/seasons/<year>.json`.
  - Frontend runtime should treat these JSON files as the source of truth.
- `src/data/initial_assets.ts`
  - Static driver / constructor seed prices.
  - Used to initialize the market before dynamic pricing takes over.
- `src/data/seasonCatalog.ts`
  - Discovers exported JSON seasons.
  - Falls back to a built-in development fixture only when no real JSON for that season exists.
- `src/context/GameContext.tsx`
  - Main game engine.
  - Handles season loading, scoring, AI managers, chips, transfer penalties, and rolling price changes.
- `src/views/*`
  - `Dashboard`: current squad and round overview.
  - `Transfer`: lineup editing, DRS target, and chip arming.
  - `RaceControl`: weekend processing and per-round report.
  - `Standings`: full ladder plus SVG cumulative trend chart.

## Run flow

### Frontend

```bash
npm install
npm run dev
```

### Real season export

```bash
pip install fastf1 pandas
python scripts/fetch_season_data.py --season 2024
```

After export, reload the frontend and choose the real season entry from the season selector.

## Game logic notes

- Transfer penalties follow the rules file directly:
  - 2 free transfers each round
  - up to 3 can be carried
  - extra transfers cost `-10`
- DRS is always active on exactly one driver.
- `Extra DRS` upgrades the multiplier from `2x` to `3x`.
- `Autopilot` moves the DRS multiplier to the highest-scoring driver after the round is scored.
- `No Negative` clamps any negative driver or constructor round total to zero.
- `Limitless` stores a backup roster and restores it after the round is processed.
- `Wildcard` removes transfer penalties for that round.
- `Final Fix` is implemented as one extra free transfer in the local one-click weekend flow. The original official timing window is quali-to-race, but this app processes the full weekend in one pass.

## Verification expectations

- `npm run build` should stay green before handoff.
- Prefer testing with a real exported season JSON after any scoring change.
- The built-in fixture is only for local UI smoke tests. It is not a substitute for FastF1 exports.
