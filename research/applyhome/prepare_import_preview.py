"""Prepare a conservative project import preview; never writes to Supabase."""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "project_geocoded_review_2026-09-29.json"
PREVIEW = HERE / "project_import_preview_2026-09-29.json"
HOLD = HERE / "project_import_hold_2026-09-29.json"


def compact(value):
    return re.sub(r"\s+", "", value or "").replace("번지", "")


def address_base(value):
    tokens = (value or "").split()
    index = next((i for i, token in enumerate(tokens)
                  if re.fullmatch(r"(?:산)?\d+(?:-\d+)?", token)), None)
    return " ".join(tokens[:index + 1]) if index is not None else ""


def matching_parcel_or_road(group):
    geocoding = group["geocoding"]
    if geocoding["status"] != "one_match":
        return False
    query = compact(geocoding.get("query_used") or group["address"])
    match = geocoding["matches"][0]
    return any(compact(base) in query for base in (
        address_base(match.get("jibun_address")),
        address_base(match.get("road_address")),
    ) if base)


def main():
    groups = json.loads(SOURCE.read_text(encoding="utf-8"))
    preview, hold = [], []
    for group in groups:
        if len(group["name_candidates"]) > 1:
            reason = "multiple_names_at_address"
        elif group["geocoding"]["status"] != "one_match":
            reason = group["geocoding"]["status"]
        elif not matching_parcel_or_road(group):
            reason = "address_result_needs_review"
        else:
            reason = None
        if reason:
            hold.append({**group, "hold_reason": reason})
            continue
        match = group["geocoding"]["matches"][0]
        preview.append({
            "name": group["name_candidates"][0]["name"],
            "address": group["address"],
            "latitude": match["latitude"],
            "longitude": match["longitude"],
            "product_type": group["product_type"],
            "proposed_product_details": {
                group["product_type"]: {
                    "units": "", "types": "", "price": "",
                    "move_in": "", "deposit": "", "interim": "",
                },
            },
            "source_notices": group["name_candidates"][0]["notice_ids"],
            "geocoded_address": match.get("jibun_address") or match.get("road_address"),
            "proposed_published": True,
            "database_action": "preview_only",
        })
    by_coordinate = defaultdict(list)
    for item in preview:
        by_coordinate[(item["latitude"], item["longitude"])].append(item)
    collisions = {key for key, items in by_coordinate.items() if len(items) > 1}
    if collisions:
        remaining = []
        for item in preview:
            if (item["latitude"], item["longitude"]) in collisions:
                hold.append({**item, "hold_reason": "coordinate_collision"})
            else:
                remaining.append(item)
        preview = remaining
    by_name = defaultdict(list)
    for item in preview:
        by_name[(compact(item["name"]), item["product_type"])].append(item)
    repeated_names = {key for key, items in by_name.items() if len(items) > 1}
    if repeated_names:
        remaining = []
        for item in preview:
            if (compact(item["name"]), item["product_type"]) in repeated_names:
                hold.append({**item, "hold_reason": "name_collision"})
            else:
                remaining.append(item)
        preview = remaining
    PREVIEW.write_text(json.dumps(preview, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    HOLD.write_text(json.dumps(hold, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"preview": len(preview), "hold": len(hold),
                      "hold_reasons": dict(Counter(item["hold_reason"] for item in hold)),
                      "database_writes": 0}, ensure_ascii=False))


if __name__ == "__main__":
    main()
