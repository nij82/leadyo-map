"""Group ApplyHome notice records for project review; never writes to the service DB."""
import json
import re
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "applyhome_candidates_2026-09-29.json"
OUTPUT = HERE / "project_review_2026-09-29.json"


def compact(value):
    return re.sub(r"\s+", "", value or "")


def main():
    notices = json.loads(SOURCE.read_text(encoding="utf-8"))
    by_address = defaultdict(list)
    for notice in notices:
        by_address[(compact(notice["address"]), notice["product_type"])].append(notice)

    groups = []
    for (_, product_type), rows in by_address.items():
        by_name = defaultdict(list)
        for row in rows:
            by_name[compact(row["name"])].append(row)
        groups.append({
            "address": rows[0]["address"],
            "product_type": product_type,
            "review_status": "needs_geocoding" if len(by_name) == 1 else "needs_name_review_and_geocoding",
            "name_candidates": [
                {
                    "name": named_rows[0]["name"],
                    "notice_ids": [
                        {"source_id": item["source_id"],
                         "announcement_id": item["announcement_id"],
                         "category": item["notice_category"],
                         "announced_at": item["announced_at"]}
                        for item in sorted(named_rows, key=lambda item: item["announced_at"])
                    ],
                }
                for named_rows in by_name.values()
            ],
            "latitude": None,
            "longitude": None,
        })
    groups.sort(key=lambda item: (item["address"], item["product_type"]))
    OUTPUT.write_text(json.dumps(groups, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "notices": len(notices),
        "address_product_groups": len(groups),
        "needs_geocoding": sum(item["review_status"] == "needs_geocoding" for item in groups),
        "needs_name_review_and_geocoding": sum(item["review_status"] == "needs_name_review_and_geocoding" for item in groups),
        "output": str(OUTPUT),
        "database_writes": 0,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
