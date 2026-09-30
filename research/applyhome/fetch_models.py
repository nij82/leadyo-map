"""Fetch the four ApplyHome notice-model endpoints for local review only.

Uses the existing APPLYHOME_SERVICE_KEY setting. Does not write to Supabase.
"""

import json
from datetime import date
from pathlib import Path

import requests

from fetch_current import API_ROOT, load_key

HERE = Path(__file__).resolve().parent
ENDPOINTS = {
    "apartment": "getAPTLttotPblancMdl",
    "officetel": "getUrbtyOfctlLttotPblancMdl",
    "remaining": "getRemndrLttotPblancMdl",
    "discretionary": "getOPTLttotPblancMdl",
}
PAGE_SIZE = 500


def fetch_all(endpoint, key):
    rows = []
    page = 1
    while True:
        try:
            response = requests.get(
                f"{API_ROOT}/{endpoint}",
                params={"page": page, "perPage": PAGE_SIZE},
                headers={"Authorization": f"Infuser {key}", "Accept": "application/json"},
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.HTTPError as error:
            raise SystemExit(f"{endpoint}: HTTP {error.response.status_code}") from None
        except (requests.RequestException, ValueError) as error:
            raise SystemExit(f"{endpoint}: {type(error).__name__}") from None
        batch = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(batch, list):
            raise SystemExit(f"{endpoint}: unexpected response")
        rows.extend(batch)
        total = payload.get("matchCount", payload.get("totalCount"))
        if not batch or (isinstance(total, int) and len(rows) >= total) or len(batch) < PAGE_SIZE:
            if isinstance(total, int) and len(rows) != total:
                raise SystemExit(f"{endpoint}: expected {total} rows, got {len(rows)}")
            return rows
        page += 1


def main():
    key = load_key()
    data = {kind: fetch_all(endpoint, key) for kind, endpoint in ENDPOINTS.items()}
    output = HERE / f"applyhome_models_{date.today().isoformat()}.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"rows": {kind: len(rows) for kind, rows in data.items()},
                      "output": str(output), "database_writes": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
