# F1 Fantasy Local Project - Handover

## 1. Current State

The project is no longer at the original scaffold-only stage. The following areas are implemented:

- `scripts/fetch_season_data.py`
  - FastF1 export script exists.
  - Supports `--season` and `--all`.
  - Exports qualifying, sprint, race, fastest-lap, and pit-stop data toward the `SeasonData` shape.
  - `.gitignore` already ignores `scripts/f1_cache/`.
- `src/data/`
  - `initial_assets.ts` defines seed pricing for the standard 20 drivers and 10 constructors.
  - `seasonCatalog.ts` loads real exported JSON from `src/data/seasons/*.json`.
  - `demoSeason2024.ts` provides a built-in fixture so the frontend can run before real FastF1 exports exist.
- `src/context/GameContext.tsx`
  - Season loading is implemented.
  - Scoring for qualifying, sprint, race, pit-stop bonuses, DRS, and chips is implemented.
  - AI manager roster selection and weekly auto-management are implemented.
  - Dynamic pricing based on rolling recent scores is implemented.
  - Limitless rollback logic is implemented.
  - First-race transfer handling is now special-cased: the season opener has no transfer limit or transfer penalty, and opener changes do not generate extra carry-over transfers.
- `src/views/`
  - `Dashboard.tsx`, `Transfer.tsx`, `RaceControl.tsx`, and `Standings.tsx` are implemented.
- `src/App.tsx` and styling
  - The Vite starter UI has been replaced with the actual game shell and season selector.

## 2. Verified So Far

- `npm run lint` passes.
- `npm run build` passes.

Known environment note:

- In the restricted sandbox used during development, `npm run dev` can fail with Vite `spawn EPERM`.
- Outside that restriction, the app can run normally.

## 3. Remaining Gaps

The main unfinished items are no longer core implementation, but real-data validation and delivery:

1. Real FastF1 season JSON has not been generated in this workspace yet.
   - `src/data/seasons/` may not exist until the export script is actually run.
2. End-to-end validation with a real exported season is still needed.
   - The built-in fixture is enough for UI and logic smoke testing, not for final data validation.
3. Full manual frontend QA is still incomplete.
   - The user explicitly asked to stop browser-based validation.
4. Git delivery work is not done.
   - No commit / push / remote setup was performed.

## 4. Important Behavior Notes

- Sprint handling:
  - If `roundData.sprint` is `null`, sprint scoring is skipped.
  - If sprint data exists, sprint position, gained/lost places, fastest lap, and DNF penalty are included in weekly scoring.
- Mid-season new drivers:
  - Any driver who appears in later `race.results` is automatically added to the market when assets are initialized from a real season dataset.
  - If the driver is not in `DRIVER_SEEDS`, fallback pricing is used.
- First race transfers:
  - Pre-season edits before Round 1 are unrestricted.
  - Free-transfer accounting starts after the first processed round.

## 5. Recommended Next Steps

1. Run real export:
   - `pip install fastf1 pandas`
   - `python scripts/fetch_season_data.py --season 2018`
2. Start the frontend locally and load the real season.
3. Run a full-season simulation to verify:
   - transfer penalties
   - sprint scoring
   - price movement bounds
   - chip behavior
4. If the user wants publication, handle git commit / remote / push after that validation.
