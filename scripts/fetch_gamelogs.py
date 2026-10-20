#!/usr/bin/env python3
"""Download one season of NBA player game logs into data/raw/.

Run this on your own computer (stats.nba.com blocks most cloud servers):

    python3 -m venv .venv && source .venv/bin/activate
    pip install -r scripts/requirements.txt
    python3 scripts/fetch_gamelogs.py --season 2025-26

It writes data/raw/<season>.json, which `npm run data:build` turns into the
file the app loads. Commit the raw file so everyone builds from the same data.
"""

import argparse
import datetime as dt
import json
import pathlib
import sys
import time

try:
    from nba_api.stats.endpoints import leaguegamelog
except ImportError:
    sys.exit("nba_api is not installed. Run: pip install -r scripts/requirements.txt")

COLUMNS = [
    "PLAYER_ID", "PLAYER_NAME", "TEAM_ABBREVIATION", "GAME_ID", "GAME_DATE", "MATCHUP",
    "MIN", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB",
    "AST", "STL", "BLK", "TOV", "PTS",
]


def fetch(season: str, season_type: str, retries: int = 4) -> dict:
    for attempt in range(retries):
        try:
            log = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star=season_type,
                player_or_team_abbreviation="P",
                timeout=60,
            )
            return log.get_dict()["resultSets"][0]
        except Exception as exc:  # stats.nba.com is flaky; back off and retry
            wait = 2 ** (attempt + 1)
            print(f"Request failed ({exc}); retrying in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    sys.exit("Could not reach stats.nba.com. Try again later or from a different network.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", default="2025-26", help="Season in YYYY-YY form (default 2025-26)")
    parser.add_argument("--season-type", default="Regular Season", choices=["Regular Season", "Playoffs"])
    parser.add_argument("--out", help="Output path (default data/raw/<season>.json)")
    args = parser.parse_args()

    result = fetch(args.season, args.season_type)
    headers = result["headers"]
    missing = [c for c in COLUMNS if c not in headers]
    if missing:
        sys.exit(f"Response is missing columns: {missing}")
    keep = [headers.index(c) for c in COLUMNS]
    rows = [[row[i] for i in keep] for row in result["rowSet"]]

    out = pathlib.Path(args.out or pathlib.Path(__file__).resolve().parent.parent / "data" / "raw" / f"{args.season}.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "season": args.season,
        "source": f"stats.nba.com LeagueGameLog ({args.season_type}) via nba_api",
        "fetchedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "headers": COLUMNS,
        "rows": rows,
    }
    out.write_text(json.dumps(payload, separators=(",", ":")))
    games = len({r[COLUMNS.index("GAME_ID")] for r in rows})
    print(f"Wrote {len(rows)} player lines from {games} games to {out}")


if __name__ == "__main__":
    main()
