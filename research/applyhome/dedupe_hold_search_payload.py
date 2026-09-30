"""Remove already-published projects from the held-project search payload.

Reads public projects through the existing publishable Supabase key and writes
only local review files. It never inserts or updates database records.
"""

import json
import math
import os
import re
from collections import defaultdict
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
STAMP = "2026-09-30"
INPUT = HERE / f"project_hold_search_payload_{STAMP}.json"
OUTPUT = HERE / f"project_hold_ready_payload_{STAMP}.json"
REPORT = HERE / f"project_hold_deduplication_{STAMP}.json"


def compact(value):
    return re.sub(r"[^0-9가-힣a-zA-Z]", "", value or "").lower()


def canonical(value):
    value = value or ""
    value = re.sub(
        r"\s*\([^)]*(?:\d+차|조합원\s*취소분|임의공급|무순위|사후)[^)]*\)",
        " ", value,
    )
    value = re.sub(r"\s*(?:\d+차|불법행위\s*재공급|임의공급|무순위|사후)\s*", " ", value)
    return compact(value)


def distance_m(a, b):
    lat1, lon1 = math.radians(a["latitude"]), math.radians(a["longitude"])
    lat2, lon2 = math.radians(b["latitude"]), math.radians(b["longitude"])
    angle = 2 * math.asin(math.sqrt(math.sin((lat2 - lat1) / 2) ** 2
                                    + math.cos(lat1) * math.cos(lat2)
                                    * math.sin((lon2 - lon1) / 2) ** 2))
    return 6371008.8 * angle


def product_types(row):
    values = set()
    summary = row.get("applyhome_summary") or {}
    if summary.get("product_type"):
        values.add(summary["product_type"])
    values.update((row.get("product_details") or {}).keys())
    return values


def config():
    values = {}
    for line in (HERE.parents[1] / "service" / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"').strip("'")
    return values["NEXT_PUBLIC_SUPABASE_URL"], values["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]


def published_projects():
    url, key = config()
    response = requests.get(
        f"{url}/rest/v1/projects",
        params={"select": "id,name,address,latitude,longitude,product_details,applyhome_summary", "published": "eq.true"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def merged_payload(rows):
    groups = defaultdict(list)
    for row in rows:
        source = row["review_source"]
        groups[(source["hogangnono_id"], row["applyhome_summary"]["product_type"])].append(row)
    merged = []
    for entries in groups.values():
        result = entries[0]
        notices = {}
        source_names, source_addresses = set(), set()
        for entry in entries:
            for notice in entry["applyhome_details"]["source_notices"]:
                notices[(notice["source_id"], notice["announcement_id"])] = notice
            source_names.update(entry["review_source"]["source_names"])
            source_addresses.add(entry["review_source"]["source_address"])
        ordered = sorted(notices.values(), key=lambda row: (row.get("announced_at") or "").replace("-", ""), reverse=True)
        result["applyhome_details"]["source_notices"] = ordered
        result["review_source"]["source_names"] = sorted(source_names)
        result["review_source"]["source_addresses"] = sorted(source_addresses)
        result["review_source"]["merged_held_groups"] = len(entries)
        latest = ordered[0]
        prices = [model["maximum_supply_price_10k_krw"] for model in latest.get("models", [])
                  if model.get("maximum_supply_price_10k_krw") is not None]
        result["applyhome_summary"].update({
            "category": latest.get("category"), "announced_at": latest.get("announced_at"),
            "notice_supply_units": latest.get("notice_supply_units"),
            "type_count": len(latest.get("models", [])),
            "price_min_10k_krw": min(prices) if prices else None,
            "price_max_10k_krw": max(prices) if prices else None,
            "planned_move_in_month": latest.get("planned_move_in_month"),
            "builder": latest.get("builder"), "business_entity": latest.get("business_entity"),
        })
        merged.append(result)
    return merged


def main():
    searched = json.loads(INPUT.read_text(encoding="utf-8"))
    candidates = merged_payload(searched)
    existing = published_projects()
    ready, duplicates = [], []
    for candidate in candidates:
        product_type = candidate["applyhome_summary"]["product_type"]
        matches = []
        for row in existing:
            if product_type not in product_types(row):
                continue
            if canonical(candidate["name"]) != canonical(row["name"]):
                continue
            meters = distance_m(candidate, row)
            if meters <= 120:
                matches.append({"id": row["id"], "name": row["name"], "address": row["address"],
                                "distance_m": round(meters, 1)})
        if matches:
            duplicates.append({"candidate": candidate["name"], "address": candidate["address"],
                               "product_type": product_type, "existing": matches})
        else:
            ready.append(candidate)
    OUTPUT.write_text(json.dumps(ready, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    REPORT.write_text(json.dumps({"searched_candidates": len(searched), "merged_candidates": len(candidates),
                                  "published_projects_checked": len(existing), "already_published": duplicates,
                                  "ready_to_insert": len(ready), "database_writes": 0},
                                 ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"searched_candidates": len(searched), "merged_candidates": len(candidates),
                      "existing": len(existing), "duplicates": len(duplicates), "ready": len(ready),
                      "database_writes": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
