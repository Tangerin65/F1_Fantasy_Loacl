#!/usr/bin/env python3
"""
fetch_season_data.py — F1 Historical Data Extractor

Uses the fastf1 library to extract real Formula 1 historical data (2018–2025)
and export it as structured JSON files for the local F1 Fantasy game frontend.

Usage:
    python fetch_season_data.py --season 2024
    python fetch_season_data.py --all

Output:
    src/data/seasons/{year}.json
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import fastf1
import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CACHE_DIR = SCRIPT_DIR / "f1_cache"
OUTPUT_DIR = PROJECT_ROOT / "src" / "data" / "seasons"

SEASON_RANGE = range(2018, 2026)  # 2018 through 2025 inclusive

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def ensure_directories():
    """Create cache and output directories if they don't exist."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def timedelta_to_formatted_string(td):
    """
    Convert a pandas Timedelta to a human-readable lap-time string
    like '1:30.031'. Returns None for NaT / NaN / None.
    """
    if td is None or pd.isna(td):
        return None
    total_seconds = td.total_seconds()
    if math.isnan(total_seconds) or total_seconds <= 0:
        return None
    minutes = int(total_seconds // 60)
    seconds = total_seconds - minutes * 60
    return f"{minutes}:{seconds:06.3f}"


def safe_value(val):
    """Return None for NaN / NaT / pd.NA, otherwise the value itself."""
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    return val


def safe_int(val):
    """Convert to int if possible, else None."""
    v = safe_value(val)
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def safe_float(val):
    """Convert to float if possible, else None."""
    v = safe_value(val)
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def clean_for_json(obj):
    """
    Recursively walk a data structure and replace any remaining
    float('nan') / NaT values with None so json.dumps doesn't choke.
    """
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_for_json(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    try:
        if pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    return obj


# ---------------------------------------------------------------------------
# Session loaders
# ---------------------------------------------------------------------------


def load_session_safe(year, round_number, session_name):
    """
    Attempt to load a fastf1 session. Returns the loaded session on
    success, or None if the session doesn't exist or fails to load.
    """
    try:
        session = fastf1.get_session(year, round_number, session_name)
        session.load(telemetry=False, weather=False, messages=False)
        return session
    except Exception as exc:
        print(f"  ⚠  Could not load {session_name} for round {round_number}: {exc}")
        return None


# ---------------------------------------------------------------------------
# Data extractors
# ---------------------------------------------------------------------------


def extract_qualifying(session):
    """Extract qualifying results from a loaded Qualifying session."""
    if session is None:
        return {"results": []}

    results = session.results
    if results is None or results.empty:
        return {"results": []}

    quali_results = []
    for _, row in results.iterrows():
        quali_results.append({
            "driver": safe_value(row.get("Abbreviation")),
            "fullName": safe_value(row.get("FullName")),
            "team": safe_value(row.get("TeamName")),
            "position": safe_int(row.get("Position")),
            "q1": timedelta_to_formatted_string(row.get("Q1")),
            "q2": timedelta_to_formatted_string(row.get("Q2")),
            "q3": timedelta_to_formatted_string(row.get("Q3")),
            "status": safe_value(row.get("Status")),
        })

    return {"results": quali_results}


def extract_fastest_lap_driver(session):
    """
    Determine the driver with the fastest lap in the given session
    by inspecting session.laps. Returns the driver abbreviation or None.
    """
    if session is None:
        return None
    try:
        laps = session.laps
        if laps is None or laps.empty:
            return None
        # Filter out laps with no time
        valid_laps = laps.dropna(subset=["LapTime"])
        if valid_laps.empty:
            return None
        fastest = valid_laps.loc[valid_laps["LapTime"].idxmin()]
        return safe_value(fastest.get("Driver"))
    except Exception as exc:
        print(f"  ⚠  Could not determine fastest lap: {exc}")
        return None


def extract_pit_stops(session):
    """
    For each constructor in the race, find the minimum pit-stop duration
    (in seconds). Returns a list of dicts sorted by fastest stop.
    """
    if session is None:
        return []

    try:
        pit_stops = getattr(session, "pit_stops", None)
        if pit_stops is not None and not pit_stops.empty:
            working = pit_stops.copy()
            duration_column = None
            for candidate in ("PitLaneTime", "Duration", "StopTime"):
                if candidate in working.columns:
                    duration_column = candidate
                    break

            if duration_column is not None:
                working[duration_column] = pd.to_timedelta(
                    working[duration_column], errors="coerce"
                )
                working["PitDuration"] = working[duration_column].dt.total_seconds()
            elif {"PitInTime", "PitOutTime"}.issubset(working.columns):
                working["PitDuration"] = (
                    working["PitOutTime"] - working["PitInTime"]
                ).dt.total_seconds()
            else:
                working["PitDuration"] = pd.NA
        else:
            laps = session.laps
            if laps is None or laps.empty:
                return []
            working = laps.dropna(subset=["PitInTime", "PitOutTime"]).copy()
            if working.empty:
                return []
            working["PitDuration"] = (
                working["PitOutTime"] - working["PitInTime"]
            ).dt.total_seconds()

        driver_team_map = {}
        if session.results is not None and not session.results.empty:
            for _, row in session.results.iterrows():
                abbr = safe_value(row.get("Abbreviation"))
                team = safe_value(row.get("TeamName"))
                if abbr and team:
                    driver_team_map[abbr] = team

        driver_column = "Driver" if "Driver" in working.columns else "Abbreviation"
        team_column = "Team" if "Team" in working.columns else "TeamName"
        if team_column in working.columns:
            working["Constructor"] = working[team_column]
        else:
            working["Constructor"] = working[driver_column].map(driver_team_map)

        working = working.dropna(subset=["Constructor", "PitDuration"])

        if working.empty:
            return []

        grouped = working.groupby("Constructor")["PitDuration"].min().reset_index()
        grouped = grouped.sort_values("PitDuration")

        pit_stops = []
        for _, row in grouped.iterrows():
            duration = safe_float(row["PitDuration"])
            if duration is not None and duration > 0:
                pit_stops.append({
                    "constructor": row["Constructor"],
                    "fastestStop": round(duration, 2),
                })

        return pit_stops

    except Exception as exc:
        print(f"  ⚠  Could not extract pit stops: {exc}")
        return []


def extract_race(session):
    """Extract race results, fastest lap, and pit stops."""
    if session is None:
        return {
            "results": [],
            "fastestLapDriver": None,
            "pitStops": [],
        }

    results = session.results
    if results is None or results.empty:
        return {
            "results": [],
            "fastestLapDriver": None,
            "pitStops": [],
        }

    race_results = []
    for _, row in results.iterrows():
        race_results.append({
            "driver": safe_value(row.get("Abbreviation")),
            "fullName": safe_value(row.get("FullName")),
            "team": safe_value(row.get("TeamName")),
            "grid": safe_int(row.get("GridPosition")),
            "position": safe_int(row.get("Position")),
            "status": safe_value(row.get("Status")),
            "points": safe_float(row.get("Points")),
        })

    return {
        "results": race_results,
        "fastestLapDriver": extract_fastest_lap_driver(session),
        "pitStops": extract_pit_stops(session),
    }


def extract_sprint(session):
    """Extract sprint race results and fastest lap."""
    if session is None:
        return None

    results = session.results
    if results is None or results.empty:
        return None

    sprint_results = []
    for _, row in results.iterrows():
        sprint_results.append({
            "driver": safe_value(row.get("Abbreviation")),
            "fullName": safe_value(row.get("FullName")),
            "team": safe_value(row.get("TeamName")),
            "grid": safe_int(row.get("GridPosition")),
            "position": safe_int(row.get("Position")),
            "status": safe_value(row.get("Status")),
            "points": safe_float(row.get("Points")),
        })

    return {
        "results": sprint_results,
        "fastestLapDriver": extract_fastest_lap_driver(session),
    }


# ---------------------------------------------------------------------------
# Main per-season logic
# ---------------------------------------------------------------------------


def fetch_season(year):
    """
    Fetch all round data for a given season year and write the JSON output
    to src/data/seasons/{year}.json.
    """
    print(f"\n{'='*60}")
    print(f"  Fetching season {year}")
    print(f"{'='*60}")

    # Get the full event schedule for this season
    schedule = fastf1.get_event_schedule(year, include_testing=False)

    rounds_data = []

    for _, event in schedule.iterrows():
        round_number = int(event["RoundNumber"])
        if round_number == 0:
            # Skip pre-season testing rows
            continue

        race_name = event.get("EventName", f"Round {round_number}")
        country = safe_value(event.get("Country"))
        event_date = event.get("EventDate")

        # Format date as YYYY-MM-DD string
        if pd.notna(event_date):
            date_str = pd.Timestamp(event_date).strftime("%Y-%m-%d")
        else:
            date_str = None

        print(f"\n  Round {round_number}: {race_name} ({country})")

        # --- Qualifying ---
        print(f"    Loading Qualifying...")
        quali_session = load_session_safe(year, round_number, "Qualifying")
        qualifying_data = extract_qualifying(quali_session)

        # --- Sprint (may not exist) ---
        print(f"    Checking for Sprint...")
        sprint_session = load_session_safe(year, round_number, "Sprint")
        sprint_data = extract_sprint(sprint_session)
        is_sprint = sprint_data is not None

        # --- Race ---
        print(f"    Loading Race...")
        race_session = load_session_safe(year, round_number, "Race")
        race_data = extract_race(race_session)

        round_entry = {
            "round": round_number,
            "raceName": race_name,
            "country": country,
            "date": date_str,
            "isSprint": is_sprint,
            "qualifying": qualifying_data,
            "sprint": sprint_data,
            "race": race_data,
        }

        rounds_data.append(round_entry)
        print(f"    ✓ Round {round_number} complete")

    # Assemble the final season object
    season_data = {
        "season": year,
        "rounds": rounds_data,
    }

    # Clean any remaining NaN/NaT values before serialization
    season_data = clean_for_json(season_data)

    # Write to JSON
    output_path = OUTPUT_DIR / f"{year}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(season_data, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n  ✓ Season {year} saved to {output_path}")
    return output_path


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fetch F1 historical data and export as JSON for F1 Fantasy."
    )
    parser.add_argument(
        "--season",
        type=int,
        choices=list(SEASON_RANGE),
        help="Season year to fetch (2018–2025).",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="fetch_all",
        help="Fetch data for all seasons (2018–2025).",
    )
    args = parser.parse_args()

    if not args.fetch_all and args.season is None:
        parser.error("Please specify --season YEAR or --all.")

    return args


def main():
    args = parse_args()

    # Enable fastf1 cache
    ensure_directories()
    fastf1.Cache.enable_cache(str(CACHE_DIR))
    print(f"Cache directory: {CACHE_DIR}")
    print(f"Output directory: {OUTPUT_DIR}")

    seasons = list(SEASON_RANGE) if args.fetch_all else [args.season]

    for year in seasons:
        try:
            fetch_season(year)
        except Exception as exc:
            print(f"\n  ✗ Failed to fetch season {year}: {exc}", file=sys.stderr)
            continue

    print(f"\n{'='*60}")
    print("  All done!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
