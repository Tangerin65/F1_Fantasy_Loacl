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
  - AI manager lineup generation now filters to the active round's driver set and uses a budget-safe roster search that prefers fuller bank usage instead of picking inactive drivers.
  - Dynamic pricing based on rolling recent scores is implemented.
  - Limitless rollback logic is implemented.
  - The human manager now starts with an empty preseason lineup; AI managers still receive generated opening rosters.
  - First-race transfer handling is now special-cased: the season opener has no transfer limit or transfer penalty, and opener changes do not generate extra carry-over transfers.
  - The old Final Fix chip has been removed from the chip type, availability state, transfer allowance logic, and Transfer Center UI.
  - Extra DRS now has separate 3X and 2X targets instead of reusing the standard single-target DRS flow.
  - Human transfer changes now reject drivers who are not active in the currently selected round.
  - When the last round has already been processed, the top action button opens a dedicated season wrap-up screen instead of trying to process another weekend.
- `src/views/`
  - `Dashboard.tsx`, `Transfer.tsx`, `RaceControl.tsx`, `Standings.tsx`, and `SeasonSummary.tsx` are implemented.
  - Dashboard now places Garage Lineup above Weekend Summary, shows last-round points on current drivers/constructors, supports clickable last-round score breakdowns, and exposes a full weekend breakdown modal with the full pit-stop ranking.
  - Weekend deep dive no longer renders the Top Pit Stops section, and the app header no longer tries to show country flags.
  - Transfer Center now uses team-colored market cards, a scrollable driver market, driver-number display, visible empty roster slots, disabled swap buttons for already-selected assets, a pre-race lineup restore button, and an Extra DRS target-selection dialog.
  - Standings now avoids duplicated manager naming, uses larger ranking-movement indicators, shows race names in chart hover tooltips, keeps legend totals on one line, and opens a manager detail modal with last-race lineup/scoring/chip breakdowns.
- `src/App.tsx` and styling
  - The Vite starter UI has been replaced with the actual game shell and season selector.
  - The shell now supports switching between English and Chinese UI copy during gameplay while preserving driver names, constructor names, and F1-specific terms in English where translation would be awkward.
  - The sidebar now keeps only Bank, the header shows the country flag next to the current round, and the old Reset Season action is replaced by Exit back to season selection.
  - Loading a race weekend now shows a short modal buffer before scoring is processed.

## 2. Verified So Far

- `npm run lint` passes.
- `npx tsc -b` passes.

Known environment note:

- In the restricted sandbox used during development, Vite commands can fail with `spawn EPERM`.
- In the latest handover update, `npm run build` was attempted but stopped at Vite config loading with the known `spawn EPERM` environment failure before app bundling. `npx tsc -b` and lint were used as the non-server verification path.
- The user explicitly asked not to do browser/server validation in this round, so only lint/build verification was performed.

## 3. Remaining Gaps

The remaining gaps are now mostly QA and real-data verification rather than missing shell flows:

1. Real FastF1 season JSON has not been generated in this workspace yet.
   - `src/data/seasons/` may not exist until the export script is actually run.
2. End-to-end validation with a real exported season is still needed.
   - The built-in fixture is enough for logic and build verification, not for final historical-data validation.
3. Full manual frontend QA is still incomplete.
   - This handover round intentionally skipped `npm run dev` / browser inspection per user request.
4. Git delivery depends on the current branch strategy and remote push being completed after review.

## 4. Important Behavior Notes

- Sprint handling:
  - If `roundData.sprint` is `null`, sprint scoring is skipped.
  - If sprint data exists, sprint position, gained/lost places, fastest lap, and DNF penalty are included in weekly scoring.
- Mid-season new drivers:
  - Any driver who appears in later `race.results` is automatically added to the market when assets are initialized from a real season dataset.
  - If the driver is not in `DRIVER_SEEDS`, fallback pricing is used.
- First race transfers:
  - The human preseason lineup starts empty and must be filled in Transfer Center.
  - Pre-season edits before Round 1 are unrestricted.
  - Free-transfer accounting starts after the first processed round.
- Restore lineup:
  - Transfer Center's restore button reverts the human roster to the locked pre-race lineup. Before Round 1, where no locked lineup exists yet, it restores to an empty preseason roster.
- Extra DRS:
  - Human managers can arm `Extra DRS`, then choose two different drivers: one for 3X and one for 2X.
  - The dialog can be reopened later from Transfer Center to adjust the targets before processing the round.
- Season completion:
  - After the final weekend is processed, the main action button switches to the wrap-up flow instead of attempting another scoring pass.

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
