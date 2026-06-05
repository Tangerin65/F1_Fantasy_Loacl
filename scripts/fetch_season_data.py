#!/usr/bin/env python3
"""
fetch_season_data.py — F1 Historical Data Extractor

Uses FastF1 first, with OpenF1 fallback for:
- pit stop data
- fastest lap driver

Output:
    src/data/seasons/{year}.json

Usage:
    python scripts/fetch_season_data.py --season 2025
    python scripts/fetch_season_data.py --season 2025 --force
    python scripts/fetch_season_data.py --season 2025 --start-round 1 --end-round 1 --force
    python scripts/fetch_season_data.py --all
"""

import argparse
import json
import math
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
import requests
import certifi
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import fastf1
import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CACHE_DIR = SCRIPT_DIR / "f1_cache"
OUTPUT_DIR = PROJECT_ROOT / "src" / "data" / "seasons"

SEASON_RANGE = range(2018, 2026)

SESSION_DELAY_SECONDS = 25
ROUND_DELAY_SECONDS = 60

OPENF1_BASE_URL = "https://api.openf1.org/v1"
OPENF1_RETRY_COUNT = 5
OPENF1_RETRY_DELAY_SECONDS = 5
OPENF1_TIMEOUT_SECONDS = 30

OPENF1_DEBUG_URLS = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class FastF1RateLimitHit(Exception):
    """Raised when FastF1 API rate limit is hit."""
    pass


def ensure_directories():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def is_rate_limit_error(exc):
    msg = str(exc).lower()
    return (
        "500 calls/h" in msg
        or "ratelimit" in msg
        or "rate limit" in msg
        or "too many requests" in msg
    )


def build_openf1_url(endpoint, params=None):
    """
    Build OpenF1 URL.

    Example:
        build_openf1_url("pit", {"session_key": 123})
        -> https://api.openf1.org/v1/pit?session_key=123
    """
    endpoint = endpoint.strip().lstrip("/")

    if params:
        query = urlencode(params)
        return f"{OPENF1_BASE_URL}/{endpoint}?{query}"

    return f"{OPENF1_BASE_URL}/{endpoint}"


def get_json_from_url(url):
    """
    Load JSON data from URL with retries.

    This version uses requests instead of urllib because urllib may fail with:
        SSL: UNEXPECTED_EOF_WHILE_READING

    Behavior:
    - 404 does not retry.
    - 400 / 401 / 403 do not retry.
    - 408 / 429 / 5xx / SSL / timeout errors retry.
    """
    headers = {
        "User-Agent": "f1-fantasy-data-fetcher/1.0",
        "Accept": "application/json",
        "Connection": "close",
    }

    if OPENF1_DEBUG_URLS and OPENF1_BASE_URL in url:
        print(f"  OpenF1 URL: {url}")

    last_error = None

    for attempt in range(1, OPENF1_RETRY_COUNT + 1):
        try:
            response = requests.get(
                url,
                headers=headers,
                timeout=OPENF1_TIMEOUT_SECONDS,
                verify=certifi.where(),
            )

            status_code = response.status_code

            if status_code == 404:
                print("  ⚠  OpenF1 returned 404 Not Found. No retry.")
                print(f"     URL: {url}")
                return []

            if status_code in (400, 401, 403):
                print(f"  ⚠  OpenF1 returned HTTP {status_code}. No retry.")
                print(f"     URL: {url}")
                return []

            if status_code in (408, 429, 500, 502, 503, 504):
                if attempt < OPENF1_RETRY_COUNT:
                    wait_seconds = OPENF1_RETRY_DELAY_SECONDS * attempt
                    print(
                        f"  ⚠  OpenF1 request failed "
                        f"({attempt}/{OPENF1_RETRY_COUNT}): HTTP {status_code}"
                    )
                    print(f"     Retrying in {wait_seconds} seconds...")
                    time.sleep(wait_seconds)
                    continue

                print(
                    f"  ⚠  OpenF1 request failed after "
                    f"{OPENF1_RETRY_COUNT} attempts: HTTP {status_code}"
                )
                return []

            response.raise_for_status()

            if not response.text.strip():
                return []

            return response.json()

        except (
            requests.exceptions.SSLError,
            requests.exceptions.ConnectionError,
            requests.exceptions.Timeout,
            requests.exceptions.ChunkedEncodingError,
            requests.exceptions.RequestException,
            json.JSONDecodeError,
        ) as exc:
            last_error = exc

            if attempt < OPENF1_RETRY_COUNT:
                wait_seconds = OPENF1_RETRY_DELAY_SECONDS * attempt
                print(
                    f"  ⚠  OpenF1 request failed "
                    f"({attempt}/{OPENF1_RETRY_COUNT}): {exc}"
                )
                print(f"     Retrying in {wait_seconds} seconds...")
                time.sleep(wait_seconds)
            else:
                print(
                    f"  ⚠  OpenF1 request failed after "
                    f"{OPENF1_RETRY_COUNT} attempts: {exc}"
                )
                return []

    if last_error:
        print(f"  ⚠  OpenF1 request gave up: {last_error}")

    return []


def get_openf1_json(endpoint, params=None):
    url = build_openf1_url(endpoint, params)
    return get_json_from_url(url)


def parse_datetime_safe(value):
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()

    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        text = value.strip()

        if not text:
            return None

        try:
            if text.endswith("Z"):
                text = text[:-1] + "+00:00"

            return datetime.fromisoformat(text)
        except ValueError:
            return None

    return None


def datetime_to_utc_naive(dt):
    if dt is None:
        return None

    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)

    return dt.replace(tzinfo=None)


def date_distance_seconds(a, b):
    a = datetime_to_utc_naive(a)
    b = datetime_to_utc_naive(b)

    if a is None or b is None:
        return None

    return abs((a - b).total_seconds())


def timedelta_to_formatted_string(td):
    if td is None or pd.isna(td):
        return None

    total_seconds = td.total_seconds()

    if math.isnan(total_seconds) or total_seconds <= 0:
        return None

    minutes = int(total_seconds // 60)
    seconds = total_seconds - minutes * 60

    return f"{minutes}:{seconds:06.3f}"


def safe_value(val):
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
    v = safe_value(val)

    if v is None:
        return None

    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def safe_float(val):
    v = safe_value(val)

    if v is None:
        return None

    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def normalize_driver_number(value):
    number = safe_int(value)

    if number is None:
        return None

    return number


def clean_for_json(obj):
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


def event_has_sprint(event):
    for i in range(1, 6):
        value = event.get(f"Session{i}")

        if not isinstance(value, str):
            continue

        if "sprint" in value.strip().lower():
            return True

    return False


def load_existing_season(year):
    output_path = OUTPUT_DIR / f"{year}.json"

    if not output_path.exists():
        return {}

    try:
        with open(output_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        rounds = data.get("rounds", [])
        result = {}

        for round_entry in rounds:
            round_number = safe_int(round_entry.get("round"))

            if round_number is not None:
                result[round_number] = round_entry

        print(f"  Loaded existing season file: {output_path}")

        return result

    except Exception as exc:
        print(f"  ⚠  Could not read existing season file {output_path}: {exc}")
        return {}


def save_season_progress(year, rounds_map):
    ordered_rounds = [
        rounds_map[round_number]
        for round_number in sorted(rounds_map.keys())
    ]

    season_data = {
        "season": year,
        "rounds": ordered_rounds,
    }

    season_data = clean_for_json(season_data)

    output_path = OUTPUT_DIR / f"{year}.json"
    temp_path = OUTPUT_DIR / f"{year}.json.tmp"

    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(season_data, f, indent=2, ensure_ascii=False, default=str)

    os.replace(temp_path, output_path)

    return output_path


def has_result_rows(session_data):
    if not isinstance(session_data, dict):
        return False

    results = session_data.get("results")

    if not isinstance(results, list):
        return False

    return len(results) > 0


def has_fastest_lap_driver(race_data):
    if not isinstance(race_data, dict):
        return False

    return bool(race_data.get("fastestLapDriver"))


def has_pit_stops(race_data):
    if not isinstance(race_data, dict):
        return False

    pit_stops = race_data.get("pitStops")

    if not isinstance(pit_stops, list):
        return False

    return len(pit_stops) > 0


def qualifying_complete(round_entry):
    if not round_entry:
        return False

    return has_result_rows(round_entry.get("qualifying"))


def race_complete(round_entry):
    """
    Race is complete only when these are present:
    - race.results
    - race.fastestLapDriver
    - race.pitStops

    This prevents a round from being skipped when results exist
    but pit stop data is still missing.
    """
    if not round_entry:
        return False

    race_data = round_entry.get("race")

    return (
        has_result_rows(race_data)
        and has_fastest_lap_driver(race_data)
        and has_pit_stops(race_data)
    )


def sprint_complete(round_entry, event):
    if not event_has_sprint(event):
        return True

    if not round_entry:
        return False

    return has_result_rows(round_entry.get("sprint"))


# ---------------------------------------------------------------------------
# FastF1 session loader
# ---------------------------------------------------------------------------

def load_session_safe(year, round_number, session_name):
    try:
        session = fastf1.get_session(year, round_number, session_name)

        session.load(
            laps=True,
            telemetry=False,
            weather=False,
            messages=False,
        )

        time.sleep(SESSION_DELAY_SECONDS)

        return session

    except Exception as exc:
        if is_rate_limit_error(exc):
            raise FastF1RateLimitHit(
                f"FastF1 rate limit hit while loading "
                f"{year} round {round_number} {session_name}: {exc}"
            )

        msg = str(exc)

        if "does not exist for this event" in msg:
            print(f"  - {session_name} does not exist for round {round_number}, skipped")
            return None

        print(f"  ⚠  Could not load {session_name} for round {round_number}: {exc}")
        return None


# ---------------------------------------------------------------------------
# OpenF1 helpers
# ---------------------------------------------------------------------------

def select_best_openf1_race_session(sessions, event_date=None, race_name=None):
    if not sessions:
        return None

    target_date = parse_datetime_safe(event_date)

    if target_date is None:
        return sessions[0]

    best_session = None
    best_distance = None

    for session in sessions:
        date_start = parse_datetime_safe(session.get("date_start"))
        distance = date_distance_seconds(date_start, target_date)

        if distance is None:
            continue

        if best_distance is None or distance < best_distance:
            best_distance = distance
            best_session = session

    if best_session is not None:
        return best_session

    return sessions[0]


def get_openf1_race_session_key(year, country_name, event_date=None, race_name=None):
    if not year:
        return None

    query_params = {
        "year": year,
        "session_name": "Race",
    }

    if country_name:
        query_params["country_name"] = country_name

    sessions = get_openf1_json("sessions", query_params)

    if not sessions and country_name:
        print(
            f"  ⚠  OpenF1: No Race session found by country_name="
            f"{country_name}. Retrying by year only..."
        )

        sessions = get_openf1_json("sessions", {
            "year": year,
            "session_name": "Race",
        })

    if not sessions:
        print(f"  ⚠  OpenF1: No Race session found for {year} {country_name}")
        return None

    selected = select_best_openf1_race_session(
        sessions=sessions,
        event_date=event_date,
        race_name=race_name,
    )

    if not selected:
        print(f"  ⚠  OpenF1: Could not select Race session for {year} {country_name}")
        return None

    session_key = selected.get("session_key")

    if session_key is None:
        print(f"  ⚠  OpenF1: Missing session_key for {year} {country_name}")
        return None

    meeting_name = selected.get("meeting_name")
    location = selected.get("location")
    date_start = selected.get("date_start")

    print(
        f"  ✓ OpenF1 Race session selected: "
        f"session_key={session_key}, "
        f"meeting={meeting_name}, "
        f"location={location}, "
        f"date_start={date_start}"
    )

    return session_key


def get_openf1_driver_maps(session_key):
    drivers = get_openf1_json("drivers", {
        "session_key": session_key,
    })

    number_to_team = {}
    number_to_abbreviation = {}

    for driver in drivers:
        driver_number = normalize_driver_number(driver.get("driver_number"))

        if driver_number is None:
            continue

        team_name = driver.get("team_name")
        abbreviation = driver.get("name_acronym")

        if team_name:
            number_to_team[driver_number] = team_name

        if abbreviation:
            number_to_abbreviation[driver_number] = abbreviation

    return number_to_team, number_to_abbreviation


# ---------------------------------------------------------------------------
# Extractors: qualifying
# ---------------------------------------------------------------------------

def extract_qualifying(session):
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


# ---------------------------------------------------------------------------
# Extractors: fastest lap
# ---------------------------------------------------------------------------

def extract_fastest_lap_driver_from_fastf1(session):
    """
    Return driver abbreviation from FastF1, for example:
        "NOR"
        "VER"
        "LEC"
    """
    if session is None:
        return None

    try:
        laps = session.laps

        if laps is None or laps.empty:
            return None

        valid_laps = laps.dropna(subset=["LapTime"])

        if valid_laps.empty:
            return None

        fastest = valid_laps.loc[valid_laps["LapTime"].idxmin()]

        return safe_value(fastest.get("Driver"))

    except Exception as exc:
        print(f"  ⚠  Could not determine fastest lap from FastF1: {exc}")
        return None


def extract_fastest_lap_driver_from_openf1(
    year,
    country_name,
    event_date=None,
    race_name=None,
):
    """
    Fallback fastest-lap extractor using OpenF1.

    Returns only the driver abbreviation string, matching frontend expectation:
        fastestLapDriver: "NOR"

    If no data is found, returns None.
    """
    if not year:
        return None

    try:
        session_key = get_openf1_race_session_key(
            year=year,
            country_name=country_name,
            event_date=event_date,
            race_name=race_name,
        )

        if session_key is None:
            return None

        _, number_to_abbreviation = get_openf1_driver_maps(session_key)

        laps = get_openf1_json("laps", {
            "session_key": session_key,
        })

        if not laps:
            print(f"  ⚠  OpenF1: No lap rows found for {year} {country_name}")
            return None

        fastest_driver_number = None
        fastest_lap_duration = None

        for row in laps:
            driver_number = normalize_driver_number(row.get("driver_number"))
            lap_duration = safe_float(row.get("lap_duration"))

            if driver_number is None:
                continue

            if lap_duration is None or lap_duration <= 0:
                continue

            if fastest_lap_duration is None or lap_duration < fastest_lap_duration:
                fastest_lap_duration = lap_duration
                fastest_driver_number = driver_number

        if fastest_driver_number is None:
            return None

        abbreviation = number_to_abbreviation.get(fastest_driver_number)

        if not abbreviation:
            print(
                f"  ⚠  OpenF1: Fastest lap driver number found "
                f"but abbreviation missing: {fastest_driver_number}"
            )
            return None

        return abbreviation

    except Exception as exc:
        print(f"  ⚠  OpenF1 fastest lap fallback failed: {exc}")
        return None


def extract_fastest_lap_driver_with_fallback(
    session,
    year,
    country_name,
    event_date=None,
    race_name=None,
):
    """
    Fastest lap strategy:
    1. Try FastF1.
    2. If FastF1 has no fastest lap, fallback to OpenF1.

    Output remains:
        fastestLapDriver: string | null
    """
    fastest_lap_driver = extract_fastest_lap_driver_from_fastf1(session)

    if fastest_lap_driver:
        print(f"  ✓ Fastest lap extracted from FastF1: {fastest_lap_driver}")
        return fastest_lap_driver

    print("  ⚠  FastF1 returned no fastest lap. Trying OpenF1 fastest lap fallback...")

    fastest_lap_driver = extract_fastest_lap_driver_from_openf1(
        year=year,
        country_name=country_name,
        event_date=event_date,
        race_name=race_name,
    )

    if fastest_lap_driver:
        print(f"  ✓ Fastest lap extracted from OpenF1: {fastest_lap_driver}")
    else:
        print("  ⚠  No fastest lap found from OpenF1 either.")

    return fastest_lap_driver


# ---------------------------------------------------------------------------
# Extractors: pit stops
# ---------------------------------------------------------------------------

def extract_pit_stops_from_fastf1(session):
    """
    Return frontend-required structure only:

        [
          { "constructor": "McLaren", "fastestStop": 18.03 },
          { "constructor": "Ferrari", "fastestStop": 18.21 }
        ]
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
                    working[duration_column],
                    errors="coerce",
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

        pit_stop_results = []

        for _, row in grouped.iterrows():
            duration = safe_float(row["PitDuration"])

            if duration is not None and duration > 0:
                pit_stop_results.append({
                    "constructor": safe_value(row["Constructor"]),
                    "fastestStop": round(duration, 2),
                })

        return pit_stop_results

    except Exception as exc:
        print(f"  ⚠  Could not extract pit stops from FastF1: {exc}")
        return []


def extract_pit_stops_from_openf1(
    year,
    country_name,
    event_date=None,
    race_name=None,
):
    """
    OpenF1 fallback for pit stops.

    Correct OpenF1 endpoint:
        /v1/pit

    Return frontend-required structure only:

        [
          { "constructor": "McLaren", "fastestStop": 18.03 },
          { "constructor": "Ferrari", "fastestStop": 18.21 }
        ]
    """
    if not year:
        return []

    try:
        session_key = get_openf1_race_session_key(
            year=year,
            country_name=country_name,
            event_date=event_date,
            race_name=race_name,
        )

        if session_key is None:
            return []

        number_to_team, _ = get_openf1_driver_maps(session_key)

        pit_rows = get_openf1_json("pit", {
            "session_key": session_key,
        })

        if not pit_rows:
            print(f"  ⚠  OpenF1: No pit rows found for {year} {country_name}")
            return []

        constructor_fastest = {}

        for row in pit_rows:
            driver_number = normalize_driver_number(row.get("driver_number"))
            pit_duration = safe_float(row.get("pit_duration"))

            if driver_number is None:
                continue

            if pit_duration is None or pit_duration <= 0:
                continue

            constructor = number_to_team.get(driver_number)

            if not constructor:
                continue

            current_fastest = constructor_fastest.get(constructor)

            if current_fastest is None or pit_duration < current_fastest:
                constructor_fastest[constructor] = pit_duration

        pit_stop_results = []

        for constructor, fastest_stop in constructor_fastest.items():
            fastest_stop = safe_float(fastest_stop)

            if fastest_stop is None or fastest_stop <= 0:
                continue

            pit_stop_results.append({
                "constructor": constructor,
                "fastestStop": round(fastest_stop, 2),
            })

        pit_stop_results = sorted(
            pit_stop_results,
            key=lambda item: item["fastestStop"],
        )

        return pit_stop_results

    except Exception as exc:
        print(f"  ⚠  OpenF1 pit stop fallback failed: {exc}")
        return []


def extract_pit_stops_with_fallback(
    session,
    year,
    country_name,
    event_date=None,
    race_name=None,
):
    """
    Pit stop strategy:
    1. Try FastF1.
    2. If FastF1 has no pit stops, fallback to OpenF1.

    Output remains:
        race.pitStops: PitStopData[]
    """
    pit_stops = extract_pit_stops_from_fastf1(session)

    if pit_stops:
        print(f"  ✓ Pit stops extracted from FastF1: {len(pit_stops)}")
        return pit_stops

    print("  ⚠  FastF1 returned no pit stops. Trying OpenF1 pit stop fallback...")

    pit_stops = extract_pit_stops_from_openf1(
        year=year,
        country_name=country_name,
        event_date=event_date,
        race_name=race_name,
    )

    if pit_stops:
        print(f"  ✓ Pit stops extracted from OpenF1: {len(pit_stops)}")
    else:
        print("  ⚠  No pit stops found from OpenF1 either.")

    return pit_stops


# ---------------------------------------------------------------------------
# Extractors: race and sprint
# ---------------------------------------------------------------------------

def extract_race(
    session,
    year=None,
    country_name=None,
    event_date=None,
    race_name=None,
):
    """
    Extract race results, fastest lap, and pit stops.

    race output shape:

        {
          "results": [],
          "fastestLapDriver": "NOR",
          "pitStops": [
            { "constructor": "McLaren", "fastestStop": 18.03 }
          ]
        }
    """
    fastest_lap_driver = extract_fastest_lap_driver_with_fallback(
        session=session,
        year=year,
        country_name=country_name,
        event_date=event_date,
        race_name=race_name,
    )

    pit_stops = extract_pit_stops_with_fallback(
        session=session,
        year=year,
        country_name=country_name,
        event_date=event_date,
        race_name=race_name,
    )

    if session is None:
        return {
            "results": [],
            "fastestLapDriver": fastest_lap_driver,
            "pitStops": pit_stops,
        }

    results = session.results

    if results is None or results.empty:
        return {
            "results": [],
            "fastestLapDriver": fastest_lap_driver,
            "pitStops": pit_stops,
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
        "fastestLapDriver": fastest_lap_driver,
        "pitStops": pit_stops,
    }


def extract_sprint(session):
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

    fastest_lap_driver = extract_fastest_lap_driver_from_fastf1(session)

    return {
        "results": sprint_results,
        "fastestLapDriver": fastest_lap_driver,
    }


# ---------------------------------------------------------------------------
# Main per-season logic
# ---------------------------------------------------------------------------

def fetch_season(year, start_round=None, end_round=None, only_missing=True):
    print(f"\n{'=' * 60}")
    print(f"  Fetching season {year}")
    print(f"{'=' * 60}")

    try:
        schedule = fastf1.get_event_schedule(year, include_testing=False)

    except Exception as exc:
        if is_rate_limit_error(exc):
            raise FastF1RateLimitHit(
                f"FastF1 rate limit hit while loading event schedule for {year}: {exc}"
            )

        raise

    rounds_map = load_existing_season(year)

    for _, event in schedule.iterrows():
        round_number = int(event["RoundNumber"])

        if round_number == 0:
            continue

        if start_round is not None and round_number < start_round:
            continue

        if end_round is not None and round_number > end_round:
            continue

        race_name = event.get("EventName", f"Round {round_number}")
        country = safe_value(event.get("Country"))
        event_date = event.get("EventDate")

        if pd.notna(event_date):
            date_str = pd.Timestamp(event_date).strftime("%Y-%m-%d")
        else:
            date_str = None

        print(f"\n  Round {round_number}: {race_name} ({country})")

        existing_round = rounds_map.get(round_number, {})

        round_entry = {
            "round": round_number,
            "raceName": race_name,
            "country": country,
            "date": date_str,
            "isSprint": bool(existing_round.get("isSprint", False)),
            "qualifying": existing_round.get("qualifying", {"results": []}),
            "sprint": existing_round.get("sprint", None),
            "race": existing_round.get("race", {
                "results": [],
                "fastestLapDriver": None,
                "pitStops": [],
            }),
        }

        # --- Qualifying ---
        if only_missing and qualifying_complete(round_entry):
            print("    ✓ Qualifying already exists, skipped")
        else:
            print("    Loading Qualifying...")
            quali_session = load_session_safe(year, round_number, "Qualifying")
            round_entry["qualifying"] = extract_qualifying(quali_session)

        # --- Sprint ---
        if not event_has_sprint(event):
            print("    - No Sprint for this event, skipped")
            round_entry["sprint"] = None
            round_entry["isSprint"] = False

        elif only_missing and sprint_complete(round_entry, event):
            print("    ✓ Sprint already exists, skipped")
            round_entry["isSprint"] = True

        else:
            print("    Loading Sprint...")
            sprint_session = load_session_safe(year, round_number, "Sprint")
            sprint_data = extract_sprint(sprint_session)
            round_entry["sprint"] = sprint_data
            round_entry["isSprint"] = sprint_data is not None

        # --- Race ---
        if only_missing and race_complete(round_entry):
            print("    ✓ Race already exists, skipped")
        else:
            existing_race = round_entry.get("race", {})

            if has_result_rows(existing_race) and not has_pit_stops(existing_race):
                print("    Loading Race because pitStops are missing...")
            elif has_result_rows(existing_race) and not has_fastest_lap_driver(existing_race):
                print("    Loading Race because fastestLapDriver is missing...")
            else:
                print("    Loading Race...")

            race_session = load_session_safe(year, round_number, "Race")
            round_entry["race"] = extract_race(
                session=race_session,
                year=year,
                country_name=country,
                event_date=event_date,
                race_name=race_name,
            )

        rounds_map[round_number] = round_entry

        output_path = save_season_progress(year, rounds_map)

        print(f"    ✓ Round {round_number} saved")
        print(f"    Saved to: {output_path}")

        time.sleep(ROUND_DELAY_SECONDS)

    output_path = save_season_progress(year, rounds_map)

    print(f"\n  ✓ Season {year} saved to {output_path}")

    return output_path


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Fetch F1 historical data and export as JSON for F1 Fantasy."
    )

    parser.add_argument(
        "--season",
        type=int,
        help="Season year to fetch, for example 2024 or 2025.",
    )

    parser.add_argument(
        "--all",
        action="store_true",
        dest="fetch_all",
        help="Fetch data for all seasons defined in SEASON_RANGE.",
    )

    parser.add_argument(
        "--start-round",
        type=int,
        help="Start fetching from this round number.",
    )

    parser.add_argument(
        "--end-round",
        type=int,
        help="Stop fetching at this round number.",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-fetch data even if existing JSON already contains it.",
    )

    args = parser.parse_args()

    if not args.fetch_all and args.season is None:
        parser.error("Please specify --season YEAR or --all.")

    if args.season is not None and args.season not in SEASON_RANGE:
        print(
            f"  ⚠  Warning: season {args.season} is outside the default range "
            f"{SEASON_RANGE.start}-{SEASON_RANGE.stop - 1}."
        )

    if (
        args.start_round is not None
        and args.end_round is not None
        and args.start_round > args.end_round
    ):
        parser.error("--start-round cannot be greater than --end-round.")

    return args


def main():
    args = parse_args()

    ensure_directories()
    fastf1.Cache.enable_cache(str(CACHE_DIR))

    print(f"Cache directory: {CACHE_DIR}")
    print(f"Output directory: {OUTPUT_DIR}")

    seasons = list(SEASON_RANGE) if args.fetch_all else [args.season]

    for year in seasons:
        try:
            fetch_season(
                year,
                start_round=args.start_round,
                end_round=args.end_round,
                only_missing=not args.force,
            )

        except FastF1RateLimitHit as exc:
            print(f"\n  ⚠ FastF1 request limit reached:")
            print(f"  {exc}")
            print("\n  操作已停止。")
            print("  请等待 60-90 分钟后，重新运行同一条命令。")
            print("  已经成功保存的数据不会丢失。")
            break

        except Exception as exc:
            print(f"\n  ✗ Failed to fetch season {year}: {exc}", file=sys.stderr)
            continue

    print(f"\n{'=' * 60}")
    print("  All done!")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()