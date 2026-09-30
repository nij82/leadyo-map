"""Collect historical ApplyHome notices and classify current project candidates.

No geocoding, DB writes or publication. A future move-in date is not proof of
unsold inventory. Past/unknown schedules remain in a separate verification list.
"""
import argparse
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

from fetch_current import HERE, SOURCES, fetch, load_key, normalize

# Only application and contract dates demonstrate a remaining sale schedule.
# Winner announcements and the publication date alone do not.
SCHEDULE_FIELDS = (
    "RCEPT_BGNDE", "RCEPT_ENDDE", "SUBSCRPT_RCEPT_BGNDE", "SUBSCRPT_RCEPT_ENDDE",
    "SPSPLY_RCEPT_BGNDE", "SPSPLY_RCEPT_ENDDE", "GNRL_RCEPT_BGNDE", "GNRL_RCEPT_ENDDE",
    "CNTRCT_CNCLS_BGNDE", "CNTRCT_CNCLS_ENDDE",
    "GNRL_RNK1_CRSPAREA_RCPTDE", "GNRL_RNK1_CRSPAREA_ENDDE",
    "GNRL_RNK1_ETC_AREA_RCPTDE", "GNRL_RNK1_ETC_AREA_ENDDE",
    "GNRL_RNK1_ETC_GG_RCPTDE", "GNRL_RNK1_ETC_GG_ENDDE",
    "GNRL_RNK2_CRSPAREA_RCPTDE", "GNRL_RNK2_CRSPAREA_ENDDE",
    "GNRL_RNK2_ETC_AREA_RCPTDE", "GNRL_RNK2_ETC_AREA_ENDDE",
    "GNRL_RNK2_ETC_GG_RCPTDE", "GNRL_RNK2_ETC_GG_ENDDE",
)


def parse_day(value):
    value = str(value or "").strip()
    if not re.fullmatch(r"\d{8}|\d{4}-\d{2}-\d{2}", value):
        return None
    digits = value.replace("-", "")
    try:
        return date(int(digits[:4]), int(digits[4:6]), int(digits[6:8]))
    except ValueError:
        return None


def parse_month(value):
    value = str(value or "").strip()
    if not re.fullmatch(r"\d{6}|\d{4}[-.]\d{2}", value):
        return None
    digits = re.sub(r"\D", "", value)
    try:
        return date(int(digits[:4]), int(digits[4:6]), 1)
    except ValueError:
        return None


def classify(row, as_of):
    announced = parse_day(row.get("RCRIT_PBLANC_DE"))
    move_in = parse_month(row.get("MVN_PREARNGE_YM"))
    remaining_schedule = {field: day.isoformat() for field in SCHEDULE_FIELDS
                          if (day := parse_day(row.get(field))) is not None and day >= as_of}
    reasons = []
    if move_in is not None and move_in >= as_of.replace(day=1):
        reasons.append("planned_move_in")
    if remaining_schedule:
        reasons.append("remaining_application_or_contract_schedule")
    # Future or invalid publication dates cannot establish a current notice.
    if announced is None or announced > as_of:
        status = "needs_publication_date_verification"
    elif reasons:
        status = "candidate_for_location_review"
    else:
        status = "needs_current_sale_verification"
    return {
        "as_of": as_of.isoformat(),
        "eligibility_status": status,
        "inclusion_reasons": reasons,
        "planned_move_in_month": move_in.strftime("%Y-%m") if move_in else None,
        "remaining_schedule": remaining_schedule,
        "current_sale_status": "unverified",
        "requires_location_and_identity_review": True,
    }


def identity(row):
    return (row["product_type"], row["source_id"], row["announcement_id"])


def group_notices(notices):
    # Review groups only: an address/type group is not a verified physical site.
    groups = {}
    for notice in notices:
        key = (re.sub(r"\s+", "", notice["address"]), notice["product_type"])
        group = groups.setdefault(key, {
            "address": notice["address"], "product_type": notice["product_type"],
            "name_candidates": [], "notices": [], "location_status": "needs_verification",
        })
        if notice["name"] not in group["name_candidates"]:
            group["name_candidates"].append(notice["name"])
        group["notices"].append(notice)
    return sorted(groups.values(), key=lambda item: (item["address"], item["product_type"]))


def prepare(raw, as_of, baseline):
    eligible, verification = [], []
    for kind, rows in raw.items():
        by_id = {(str(row.get("HOUSE_MANAGE_NO") or "").strip(),
                  str(row.get("PBLANC_NO") or "").strip()): row for row in rows}
        for notice in normalize(kind, rows):
            row = by_id[(notice["source_id"], notice["announcement_id"])]
            notice["currentness_review"] = classify(row, as_of)
            notice["official_notice_url"] = row.get("PBLANC_URL") or None
            notice["homepage_url"] = row.get("HMPG_ADRES") or None
            notice["new_to_previous_collection"] = identity(notice) not in baseline
            if notice["currentness_review"]["eligibility_status"] == "candidate_for_location_review":
                eligible.append(notice)
            else:
                verification.append(notice)
    return eligible, verification


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today())
    parser.add_argument("--baseline", type=Path, default=HERE / "applyhome_candidates_2026-09-29.json")
    parser.add_argument("--raw-file", type=Path, help="Use a saved full-history response instead of API calls")
    args = parser.parse_args()
    if not args.baseline.exists():
        parser.error("Baseline file does not exist; specify --baseline explicitly")
    previous = json.loads(args.baseline.read_text(encoding="utf-8"))
    if args.raw_file:
        raw = json.loads(args.raw_file.read_text(encoding="utf-8"))
    else:
        key = load_key()
        raw = {}
        for kind, endpoint in SOURCES.items():
            raw[kind] = fetch(endpoint, key, start_date=None)
            print(json.dumps({"source": kind, "raw_notices": len(raw[kind])}, ensure_ascii=False), flush=True)
    eligible, verification = prepare(raw, args.as_of, {identity(row) for row in previous})
    additions = [row for row in eligible if row["new_to_previous_collection"]]
    baseline_groups = {(re.sub(r"\s+", "", row["address"]), row["product_type"]) for row in previous}
    additional_groups = group_notices(additions)
    for group in additional_groups:
        group["address_type_in_previous_collection"] = (re.sub(r"\s+", "", group["address"]), group["product_type"]) in baseline_groups
    novel_groups = [group for group in additional_groups if not group["address_type_in_previous_collection"]]
    stamp = args.as_of.isoformat()
    outputs = {
        "raw": (f"applyhome_full_history_raw_{stamp}.json", raw),
        "candidates": (f"applyhome_active_candidates_{stamp}.json", eligible),
        "additional_groups": (f"project_active_additional_review_{stamp}.json", additional_groups),
        "new_address_groups": (f"project_active_new_address_review_{stamp}.json", novel_groups),
        "verification": (f"applyhome_current_sale_verification_{stamp}.json", verification),
    }
    report = {
        "as_of": stamp, "announcement_start_date": None,
        "baseline": str(args.baseline), "raw_notices_by_source": {kind: len(rows) for kind, rows in raw.items()},
        "eligible_notices": len(eligible), "eligible_address_type_review_groups": len(group_notices(eligible)),
        "additional_notices": len(additions), "additional_address_type_review_groups": len(additional_groups),
        "additional_groups_at_previously_collected_addresses": len(additional_groups) - len(novel_groups),
        "new_address_type_review_groups": len(novel_groups),
        "additional_inclusion_reasons": dict(Counter(reason for row in additions for reason in row["currentness_review"]["inclusion_reasons"])),
        "additional_notice_years": dict(sorted(Counter(str(row["announced_at"])[:4] for row in additions).items())),
        "needs_current_sale_verification_notices": len(verification),
        "files": {label: str(HERE / filename) for label, (filename, _) in outputs.items()},
        "database_writes": 0,
    }
    for filename, payload in outputs.values():
        (HERE / filename).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (HERE / f"active_collection_report_{stamp}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
