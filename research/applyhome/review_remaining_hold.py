"""Compare remaining held ApplyHome projects against Hogangnono search results.

This script produces a review report and a candidate payload. It never writes
to Supabase. A candidate requires a matching name, product type, and exactly
one Hogangnono result. Unmatched or ambiguous records remain in the report.
"""

import json
import re
import time
from collections import Counter
from datetime import date
from pathlib import Path
from urllib.parse import quote

import requests

HERE = Path(__file__).resolve().parent
STAMP = date.today().isoformat()
HOLD = HERE / "project_import_hold_2026-09-29.json"
VERIFIED = HERE / "project_hold_verified_payload_2026-09-29.json"
NOTICE_DETAILS = HERE / "notice_details_2026-09-29.json"
CACHE = HERE / f"hogangnono_hold_search_{STAMP}.json"
REPORT = HERE / f"project_hold_search_review_{STAMP}.json"
PAYLOAD = HERE / f"project_hold_search_payload_{STAMP}.json"

KIND = {
    "APT 일반 분양공고": "apartment",
    "오피스텔 분양공고": "officetel",
    "APT 무순위 공고": "remaining",
    "APT 불법행위 재공급 공고": "remaining",
    "APT 임의공급 공고": "discretionary",
}
TYPE = {"apartment": 0, "officetel": 1}


def compact(value):
    return re.sub(r"[^0-9가-힣a-zA-Z]", "", value or "").lower()


def canonical(value):
    value = value or ""
    value = re.sub(
        r"\s*\([^)]*(?:\d+차|조합원\s*취소분|임의공급|무순위|사후)[^)]*\)",
        " ",
        value,
    )
    value = re.sub(r"\s*(?:\d+차|불법행위\s*재공급|임의공급|무순위|사후)\s*", " ", value)
    return compact(value)


def source_names(group):
    names = [row["name"] for row in group.get("name_candidates", [])]
    return names or [group.get("name", "")]


def preferred_name(group):
    names = source_names(group)
    return min(names, key=lambda value: (len(canonical(value)), len(value)))


def source_refs(group):
    if group.get("name_candidates"):
        return [ref for candidate in group["name_candidates"] for ref in candidate["notice_ids"]]
    return group.get("source_notices", [])


def parse_search(html):
    marker = '"searchResults":'
    start = html.find(marker)
    if start < 0:
        raise ValueError("Hogangnono search state not found")
    start += len(marker)
    return json.JSONDecoder().raw_decode(html[start:])[0]


def fetch(session, query):
    response = session.get(
        f"https://hogangnono.com/search?q={quote(query)}",
        timeout=20,
        headers={"Accept": "text/html"},
    )
    response.raise_for_status()
    return parse_search(response.text).get("apt", {}).get("list", [])


def is_name_match(source, result):
    wanted, actual = canonical(source), compact(result.get("name"))
    return bool(wanted and actual and (wanted == actual or wanted in actual or actual in wanted))


def address_score(source, result):
    haystack = compact(" ".join(filter(None, [result.get("address"), result.get("road_address")])))
    source_compact = compact(source)
    score = 0
    for token in re.findall(r"[가-힣]+(?:동|읍|면|리)", source):
        if compact(token) in haystack:
            score += 2
    parcels = re.findall(r"산?\d+(?:-\d+)?", source)
    if any(compact(token) in haystack for token in parcels):
        score += 5
    roads = re.findall(r"[가-힣0-9]+(?:로|길)\s*\d+(?:-\d+)?", source)
    if any(compact(token) in haystack for token in roads):
        score += 5
    if source_compact and source_compact in haystack:
        score += 10
    return score


def notices_for(group, details):
    rows = []
    for ref in source_refs(group):
        kind = KIND.get(ref.get("category"))
        key = (str(ref.get("source_id")), str(ref.get("announcement_id")))
        notice = details.get((kind, *key)) if kind else None
        if notice:
            rows.append(notice)
    return sorted(rows, key=lambda row: (row.get("announced_at") or "").replace("-", ""), reverse=True)


def payload_row(group, result, details):
    notices = notices_for(group, details)
    if not notices:
        return None
    latest = notices[0]
    models = latest.get("models", [])
    prices = [row["maximum_supply_price_10k_krw"] for row in models
              if row.get("maximum_supply_price_10k_krw") is not None]
    product_type = group["product_type"]
    return {
        "name": result["name"],
        "address": result["address"],
        "latitude": result["lat"],
        "longitude": result["lng"],
        "published": True,
        "product_details": {product_type: {"units": "", "types": "", "price": "",
                                             "move_in": "", "deposit": "", "interim": ""}},
        "applyhome_summary": {
            "product_type": product_type,
            "category": latest.get("category"),
            "announced_at": latest.get("announced_at"),
            "notice_supply_units": latest.get("notice_supply_units"),
            "type_count": len(models),
            "price_min_10k_krw": min(prices) if prices else None,
            "price_max_10k_krw": max(prices) if prices else None,
            "planned_move_in_month": latest.get("planned_move_in_month"),
            "builder": latest.get("builder"),
            "business_entity": latest.get("business_entity"),
        },
        "applyhome_details": {
            "collected_at": STAMP,
            "product_type": product_type,
            "source_notices": notices,
            "nearby_planned_move_in": [],
        },
        "review_source": {
            "source_address": group["address"],
            "source_names": source_names(group),
            "hold_reason": group["hold_reason"],
            "hogangnono_id": result["id"],
            "hogangnono_road_address": result.get("road_address"),
        },
    }


def main():
    held = json.loads(HOLD.read_text(encoding="utf-8"))
    verified = json.loads(VERIFIED.read_text(encoding="utf-8"))
    verified_indices = {row["index"] for row in verified}
    groups = [(index, group) for index, group in enumerate(held) if index not in verified_indices]
    details = {
        (row["kind"], str(row["source_id"]), str(row["announcement_id"])): row
        for row in json.loads(NOTICE_DETAILS.read_text(encoding="utf-8"))
    }
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    session = requests.Session()
    review, payload = [], []
    for position, (index, group) in enumerate(groups, start=1):
        query = preferred_name(group)
        if query not in cache:
            try:
                cache[query] = {"results": fetch(session, query), "error": None}
            except (requests.RequestException, ValueError) as error:
                cache[query] = {"results": [], "error": str(error)}
            CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            time.sleep(0.25)
        found = cache[query]
        expected_type = TYPE[group["product_type"]]
        matches = [row for row in found["results"]
                   if row.get("type") == expected_type and is_name_match(query, row)]
        outcome = "unresolved"
        if found["error"]:
            outcome = "search_error"
        elif len(matches) == 1:
            candidate = payload_row(group, matches[0], details)
            if candidate:
                payload.append(candidate)
                outcome = "candidate"
            else:
                outcome = "missing_notice_detail"
        elif len(matches) > 1:
            scored = [(address_score(group["address"], row), row) for row in matches]
            highest = max(score for score, _ in scored)
            best = [row for score, row in scored if score == highest]
            if highest >= 5 and len(best) == 1:
                candidate = payload_row(group, best[0], details)
                if candidate:
                    payload.append(candidate)
                    outcome = "candidate_address_matched"
                else:
                    outcome = "missing_notice_detail"
            else:
                outcome = "multiple_hogangnono_matches"
        else:
            outcome = "no_hogangnono_match"
        review.append({
            "index": index,
            "name": query,
            "source_names": source_names(group),
            "source_address": group["address"],
            "product_type": group["product_type"],
            "hold_reason": group["hold_reason"],
            "outcome": outcome,
            "hogangnono_matches": [{key: row.get(key) for key in
                                      ("id", "name", "type_name", "address", "road_address", "lat", "lng")}
                                    for row in matches],
        })
        if position % 25 == 0 or position == len(groups):
            print(f"{position}/{len(groups)} searched", flush=True)
    REPORT.write_text(json.dumps({"searched_at": STAMP, "rows": review,
                                  "counts": Counter(row["outcome"] for row in review)},
                                 ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PAYLOAD.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"searched": len(review), "candidates": len(payload),
                      "outcomes": Counter(row["outcome"] for row in review),
                      "database_writes": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
