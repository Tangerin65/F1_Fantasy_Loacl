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
OPENF1_TIMEOUT_SECONDS = 15

OPENF1_DEBUG_URLS = False

# ---------------------------------------------------------------------------
# Jolpica (Ergast replacement) — https://api.jolpi.ca/ergast/f1/
# ---------------------------------------------------------------------------

JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1"
JOLPICA_TIMEOUT_SECONDS = 30

JOLPICA_CONSTRUCTOR_MAP = {
    "Red Bull": "Red Bull Racing",
    "Ferrari": "Ferrari",
    "McLaren": "McLaren",
    "Mercedes": "Mercedes",
    "Aston Martin": "Aston Martin",
    "Alpine F1 Team": "Alpine",
    "Alpine": "Alpine",
    "Williams": "Williams",
    "RB F1 Team": "RB F1 Team",
    "RB": "RB F1 Team",
    "Haas F1 Team": "Haas F1 Team",
    "Haas": "Haas F1 Team",
    "Sauber": "Sauber",
    "Kick Sauber": "Sauber",
    "Alfa Romeo": "Sauber",
    "Alfa Romeo Sauber": "Sauber",
    "Stake F1 Team": "Sauber",
    "Stake": "Sauber",
    "Toro Rosso": "RB F1 Team",
    "AlphaTauri": "RB F1 Team",
    "Force India": "Racing Point",
    "Racing Point": "Aston Martin",
    "Lotus F1": "Alpine",
    "Renault": "Alpine",
}


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
    Load JSON data from URL — single attempt, no retry.

    Uses requests instead of urllib because urllib may fail with:
        SSL: UNEXPECTED_EOF_WHILE_READING

    - 404 / 400 / 401 / 403 do not retry (returns []).
    - 408 / 429 / 5xx / SSL / timeout / any error returns [] directly.
    """
    headers = {
        "User-Agent": "f1-fantasy-data-fetcher/1.0",
        "Accept": "application/json",
        "Connection": "close",
    }

    if OPENF1_DEBUG_URLS and OPENF1_BASE_URL in url:
        print(f"  OpenF1 URL: {url}")

    try:
        response = requests.get(
            url,
            headers=headers,
            timeout=OPENF1_TIMEOUT_SECONDS,
            verify=certifi.where(),
        )

        status_code = response.status_code

        if status_code in (404, 400, 401, 403):
            print(f"  ⚠  OpenF1 returned HTTP {status_code}. No retry.")
            print(f"     URL: {url}")
            return []

        if status_code in (408, 429, 500, 502, 503, 504):
            print(f"  ⚠  OpenF1 request failed: HTTP {status_code}")
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
        print(f"  ⚠  OpenF1 request failed: {exc}")
        return []


def get_openf1_json(endpoint, params=None):
    url = build_openf1_url(endpoint, params)
    return get_json_from_url(url)


def get_jolpica_json(endpoint):
    """
    Fetch data from the Jolpica API (Ergast replacement).

    Endpoint format (no leading slash):
        2024/1/results.json?limit=30
        2024/1/pitstops.json?limit=100

    Returns the MRData dict, or None on failure.
    """
    endpoint = endpoint.strip().lstrip("/")
    url = f"{JOLPICA_BASE_URL}/{endpoint}"

    data = get_json_from_url(url)
    if not data:
        return None

    if isinstance(data, dict):
        return data.get("MRData")

    return None


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

    print(f"  → OpenF1 session_key={session_key} selected")

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


def extract_fastest_lap_driver_from_jolpica(year, round_number):
    """
    Get fastest lap driver from Jolpica results endpoint.

    Jolpica's results endpoint includes a FastestLap.rank field,
    so we find the result with rank=1 and return Driver.code.
    """
    if not year or not round_number:
        return None

    try:
        mrdata = get_jolpica_json(f"{year}/{round_number}/results.json?limit=30")
        if not mrdata:
            return None

        races = mrdata.get("RaceTable", {}).get("Races", [])
        if not races:
            return None

        for result in races[0].get("Results", []):
            fastest_lap = result.get("FastestLap", {})
            if fastest_lap.get("rank") == "1":
                return result.get("Driver", {}).get("code")

        return None

    except Exception as exc:
        print(f"  ⚠  Jolpica fastest lap lookup failed: {exc}")
        return None


def extract_fastest_lap_driver_with_fallback(
    session,
    year,
    country_name,
    round_number,
    event_date=None,
    race_name=None,
):
    """
    Fastest lap strategy:
    1. Try Jolpica (no session required).
    2. Try FastF1.
    3. Try OpenF1.
    4. All failed → return None.
    """
    fastest_lap_driver = extract_fastest_lap_driver_from_jolpica(year, round_number)

    if fastest_lap_driver:
        print(f"  ✓ Fastest lap from Jolpica: {fastest_lap_driver}")
        return fastest_lap_driver

    print("  → Trying FastF1 for fastest lap...")

    fastest_lap_driver = extract_fastest_lap_driver_from_fastf1(session)

    if fastest_lap_driver:
        print(f"  ✓ Fastest lap from FastF1: {fastest_lap_driver}")
        return fastest_lap_driver

    print("  → Trying OpenF1 for fastest lap...")

    fastest_lap_driver = extract_fastest_lap_driver_from_openf1(
        year=year,
        country_name=country_name,
        event_date=event_date,
        race_name=race_name,
    )

    if fastest_lap_driver:
        print(f"  ✓ Fastest lap from OpenF1: {fastest_lap_driver}")
    else:
        print("  ✗ No fastest lap found from any source.")

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


def extract_pit_stops_from_jolpica(year, round_number):
    """
    Get pit stops from the Jolpica API.

    Strategy:
    1. Fetch results.json for driver → constructor mapping.
    2. Fetch pitstops.json and group by constructor.
    Returns the frontend-required structure:
        [{ "constructor": "McLaren", "fastestStop": 18.03 }, ...]
    """
    if not year or not round_number:
        return []

    try:
        # 1. Get results for driverId → constructor mapping
        results_mrdata = get_jolpica_json(f"{year}/{round_number}/results.json?limit=30")
        if not results_mrdata:
            return []

        races = results_mrdata.get("RaceTable", {}).get("Races", [])
        if not races:
            return []

        driver_to_constructor = {}
        for result in races[0].get("Results", []):
            driver_id = result.get("Driver", {}).get("driverId")
            constructor_name = result.get("Constructor", {}).get("name")
            if driver_id and constructor_name:
                normalized = JOLPICA_CONSTRUCTOR_MAP.get(constructor_name, constructor_name)
                driver_to_constructor[driver_id] = normalized

        # 2. Get pit stops
        pit_mrdata = get_jolpica_json(f"{year}/{round_number}/pitstops.json?limit=100")
        if not pit_mrdata:
            return []

        pit_races = pit_mrdata.get("RaceTable", {}).get("Races", [])
        if not pit_races:
            return []

        constructor_fastest = {}
        for pit in pit_races[0].get("PitStops", []):
            driver_id = pit.get("driverId")
            duration_str = pit.get("duration", "0")
            try:
                duration = float(duration_str)
            except (ValueError, TypeError):
                continue

            constructor = driver_to_constructor.get(driver_id)
            if not constructor:
                continue

            if duration <= 0:
                continue

            current = constructor_fastest.get(constructor)
            if current is None or duration < current:
                constructor_fastest[constructor] = duration

        pit_stops = [
            {"constructor": c, "fastestStop": round(d, 2)}
            for c, d in sorted(constructor_fastest.items(), key=lambda x: x[1])
        ]

        return pit_stops

    except Exception as exc:
        print(f"  ⚠  Jolpica pit stop lookup failed: {exc}")
        return []


def extract_pit_stops_with_fallback(
    session,
    year,
    country_name,
    round_number,
    event_date=None,
    race_name=None,
):
    """
    Pit stop strategy:
    1. Try Jolpica (no session required).
    2. Try FastF1.
    3. Try OpenF1.
    4. All failed → return [].
    """
    pit_stops = extract_pit_stops_from_jolpica(year, round_number)

    if pit_stops:
        print(f"  ✓ Pit stops from Jolpica: {len(pit_stops)} teams")
        return pit_stops

    print("  → Trying FastF1 for pit stops...")

    pit_stops = extract_pit_stops_from_fastf1(session)

    if pit_stops:
        print(f"  ✓ Pit stops from FastF1: {len(pit_stops)} teams")
        return pit_stops

    print("  → Trying OpenF1 for pit stops...")

    pit_stops = extract_pit_stops_from_openf1(
        year=year,
        country_name=country_name,
        event_date=event_date,
        race_name=race_name,
    )

    if pit_stops:
        print(f"  ✓ Pit stops from OpenF1: {len(pit_stops)} teams")
    else:
        print("  ✗ No pit stops found from any source.")

    return pit_stops


# ---------------------------------------------------------------------------
# Extractors: race and sprint
# ---------------------------------------------------------------------------

def extract_race(
    session,
    year=None,
    country_name=None,
    round_number=None,
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
          ],
          "driverOfTheDay": null   # placeholder — filled manually
        }
    """
    fastest_lap_driver = extract_fastest_lap_driver_with_fallback(
        session=session,
        year=year,
        country_name=country_name,
        round_number=round_number,
        event_date=event_date,
        race_name=race_name,
    )

    pit_stops = extract_pit_stops_with_fallback(
        session=session,
        year=year,
        country_name=country_name,
        round_number=round_number,
        event_date=event_date,
        race_name=race_name,
    )

    if session is None:
        return {
            "results": [],
            "fastestLapDriver": fastest_lap_driver,
            "pitStops": pit_stops,
            "driverOfTheDay": None,
        }

    results = session.results

    if results is None or results.empty:
        return {
            "results": [],
            "fastestLapDriver": fastest_lap_driver,
            "pitStops": pit_stops,
            "driverOfTheDay": None,
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
        "driverOfTheDay": None,
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
                "driverOfTheDay": None,
            }),
        }

        # Backward compatibility: ensure driverOfTheDay exists for older JSON.
        if "driverOfTheDay" not in round_entry.get("race", {}):
            round_entry["race"]["driverOfTheDay"] = None

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
                round_number=round_number,
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