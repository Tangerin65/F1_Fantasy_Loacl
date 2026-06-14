#!/usr/bin/env python3
"""
compute_initial_prices.py — derive F1 Fantasy opening prices from the previous
season's championship standings via Jolpica (Ergast-compatible) API.

Output:
    src/data/initial_prices/{season}.json

Usage:
    python scripts/compute_initial_prices.py --season 2024
    python scripts/compute_initial_prices.py --all
    python scripts/compute_initial_prices.py --season 2025 --driver-default 7.0 --constructor-default 8.0
"""

import argparse
import json
import sys
import time
from pathlib import Path

import certifi
import requests

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "src" / "data" / "initial_prices"

SEASON_RANGE = range(2018, 2026)
JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1"
JOLPICA_TIMEOUT_SECONDS = 30
REQUEST_DELAY_SECONDS = 1.5

DRIVER_PRICE_MIN = 3.0
DRIVER_PRICE_MAX = 30.0
CONSTRUCTOR_PRICE_MIN = 3.0
CONSTRUCTOR_PRICE_MAX = 30.0

DRIVER_DEFAULT_PRICE = 6.0
CONSTRUCTOR_DEFAULT_PRICE = 8.0

CONSTRUCTOR_NAME_MAP = {
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
    "Toro Rosso": "Toro Rosso",
    "AlphaTauri": "AlphaTauri",
    "Force India": "Force India",
    "Racing Point": "Racing Point",
    "Renault": "Renault",
}


def clamp(value, lower, upper):
    return round(max(lower, min(upper, value)), 1)


def fetch_jolpica(endpoint):
    endpoint = endpoint.strip().lstrip("/")
    url = f"{JOLPICA_BASE_URL}/{endpoint}"
    headers = {
        "User-Agent": "f1-fantasy-price-builder/1.0",
        "Accept": "application/json",
        "Connection": "close",
    }
    response = requests.get(
        url,
        headers=headers,
        timeout=JOLPICA_TIMEOUT_SECONDS,
        verify=certifi.where(),
    )
    response.raise_for_status()
    return response.json().get("MRData", {})


def full_driver_name(driver):
    given = driver.get("givenName", "").strip()
    family = driver.get("familyName", "").strip()
    return " ".join(part for part in (given, family) if part)


def driver_code(driver):
    code = driver.get("code")
    if code:
        return code.upper()
    family = driver.get("familyName", "")
    return family[:3].upper()


def normalize_constructor_name(name):
    return CONSTRUCTOR_NAME_MAP.get(name, name)


def price_curve(position, points, max_points, grid_size, minimum, maximum):
    if grid_size <= 1:
        rank_factor = 1.0
    else:
        rank_factor = (grid_size - position) / (grid_size - 1)
    point_factor = (points / max_points) if max_points > 0 else 0
    blended = 0.62 * rank_factor + 0.38 * point_factor
    return clamp(minimum + (maximum - minimum) * blended, minimum, maximum)


def fetch_driver_standings(season):
    data = fetch_jolpica(f"{season}/driverstandings.json?limit=100")
    lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    return lists[0].get("DriverStandings", []) if lists else []


def fetch_constructor_standings(season):
    data = fetch_jolpica(f"{season}/constructorstandings.json?limit=100")
    lists = data.get("StandingsTable", {}).get("StandingsLists", [])
    return lists[0].get("ConstructorStandings", []) if lists else []


def build_price_book(season, driver_default, constructor_default):
    source_season = season - 1
    driver_standings = fetch_driver_standings(source_season)
    time.sleep(REQUEST_DELAY_SECONDS)
    constructor_standings = fetch_constructor_standings(source_season)

    if not driver_standings and not constructor_standings:
        raise RuntimeError(f"No championship standings found for {source_season}")

    max_driver_points = max((float(entry.get("points", 0)) for entry in driver_standings), default=0)
    max_constructor_points = max((float(entry.get("points", 0)) for entry in constructor_standings), default=0)

    drivers = {}
    driver_meta = {}
    for entry in driver_standings:
        position = int(entry.get("position", len(drivers) + 1))
        points = float(entry.get("points", 0))
        driver = entry.get("Driver", {})
        code = driver_code(driver)
        drivers[code] = price_curve(
            position,
            points,
            max_driver_points,
            len(driver_standings),
            DRIVER_PRICE_MIN,
            DRIVER_PRICE_MAX,
        )
        driver_meta[code] = {
            "name": full_driver_name(driver),
            "standing": position,
            "points": points,
        }

    constructors = {}
    constructor_meta = {}
    for entry in constructor_standings:
        position = int(entry.get("position", len(constructors) + 1))
        points = float(entry.get("points", 0))
        constructor = entry.get("Constructor", {})
        name = normalize_constructor_name(constructor.get("name", ""))
        if not name:
            continue
        constructors[name] = price_curve(
            position,
            points,
            max_constructor_points,
            len(constructor_standings),
            CONSTRUCTOR_PRICE_MIN,
            CONSTRUCTOR_PRICE_MAX,
        )
        constructor_meta[name] = {
            "standing": position,
            "points": points,
        }

    return {
        "season": season,
        "generatedFromSeason": source_season,
        "defaultDriverPrice": driver_default,
        "defaultConstructorPrice": constructor_default,
        "drivers": drivers,
        "constructors": constructors,
        "metadata": {
            "source": "Jolpica Ergast-compatible championship standings",
            "driverPriceRange": [DRIVER_PRICE_MIN, DRIVER_PRICE_MAX],
            "constructorPriceRange": [CONSTRUCTOR_PRICE_MIN, CONSTRUCTOR_PRICE_MAX],
            "driverStandings": driver_meta,
            "constructorStandings": constructor_meta,
        },
    }


def write_price_book(book):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{book['season']}.json"
    output_path.write_text(json.dumps(book, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Wrote {output_path.relative_to(PROJECT_ROOT)}")


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Compute opening F1 Fantasy prices from previous-season standings.")
    parser.add_argument("--season", type=int, help="Target fantasy season, e.g. 2024 uses 2023 standings.")
    parser.add_argument("--all", action="store_true", help="Generate price books for all supported seasons.")
    parser.add_argument("--driver-default", type=float, default=DRIVER_DEFAULT_PRICE, help="Default price for rookies/new drivers.")
    parser.add_argument("--constructor-default", type=float, default=CONSTRUCTOR_DEFAULT_PRICE, help="Default price for new constructors.")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv or sys.argv[1:])
    if not args.all and not args.season:
        raise SystemExit("Use --season YEAR or --all")

    seasons = list(SEASON_RANGE) if args.all else [args.season]
    for index, season in enumerate(seasons):
        if season <= 1950:
            raise SystemExit("Season must be later than 1950 so a previous standings year exists.")
        print(f"Building {season} opening prices from {season - 1} standings...")
        book = build_price_book(season, args.driver_default, args.constructor_default)
        write_price_book(book)
        if index < len(seasons) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)


if __name__ == "__main__":
    main()
