"""Join collected ApplyHome notices and models to reviewed project locations.

Produces local review data only. Notice-specific supply is kept separate from
the sum of model rows, since the two values can differ in the source.
"""

import csv
import json
import math
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAMP = date.today().isoformat()
RAW = HERE / f"applyhome_raw_{STAMP}.json"
MODELS = HERE / f"applyhome_models_{STAMP}.json"
CANDIDATES = HERE / f"applyhome_candidates_{STAMP}.json"
PREVIEW = HERE / f"project_import_preview_{STAMP}.json"
OUTPUT = HERE / f"project_details_review_{STAMP}.json"
NOTICE_OUTPUT = HERE / f"notice_details_{STAMP}.json"
REPORT = HERE / f"project_details_report_{STAMP}.json"
SUMMARY = HERE / f"project_details_summary_{STAMP}.csv"
KIND_BY_CATEGORY = {
    "APT 일반 분양공고": "apartment",
    "오피스텔 분양공고": "officetel",
    "APT 무순위 공고": "remaining",
    "APT 불법행위 재공급 공고": "remaining",
    "APT 임의공급 공고": "discretionary",
}
SCHEDULE_FIELDS = (
    "RCRIT_PBLANC_DE", "RCEPT_BGNDE", "RCEPT_ENDDE",
    "SPSPLY_RCEPT_BGNDE", "SPSPLY_RCEPT_ENDDE",
    "SUBSCRPT_RCEPT_BGNDE", "SUBSCRPT_RCEPT_ENDDE",
    "GNRL_RCEPT_BGNDE", "GNRL_RCEPT_ENDDE",
    "GNRL_RNK1_CRSPAREA_RCPTDE", "GNRL_RNK1_CRSPAREA_ENDDE",
    "GNRL_RNK1_ETC_AREA_RCPTDE", "GNRL_RNK1_ETC_AREA_ENDDE",
    "GNRL_RNK1_ETC_GG_RCPTDE", "GNRL_RNK1_ETC_GG_ENDDE",
    "GNRL_RNK2_CRSPAREA_RCPTDE", "GNRL_RNK2_CRSPAREA_ENDDE",
    "GNRL_RNK2_ETC_AREA_RCPTDE", "GNRL_RNK2_ETC_AREA_ENDDE",
    "GNRL_RNK2_ETC_GG_RCPTDE", "GNRL_RNK2_ETC_GG_ENDDE",
    "PRZWNER_PRESNATN_DE", "CNTRCT_CNCLS_BGNDE", "CNTRCT_CNCLS_ENDDE",
)


def key(row):
    return str(row["HOUSE_MANAGE_NO"]), str(row["PBLANC_NO"])


def number(value):
    if value is None or str(value).strip() in ("", "-"):
        return None
    try:
        return int(str(value).replace(",", ""))
    except ValueError:
        return None


def text(value):
    value = str(value or "").strip()
    return value or None


def model_detail(kind, row):
    general = number(row.get("SUPLY_HSHLDCO"))
    special = number(row.get("SPSPLY_HSHLDCO"))
    return {
        "model_no": text(row.get("MODEL_NO")),
        "type": text(row.get("TP") if kind == "officetel" else row.get("HOUSE_TY")),
        "group": text(row.get("GP")) if kind == "officetel" else None,
        "supply_area_m2": text(row.get("SUPLY_AR")),
        "exclusive_area_m2": text(row.get("EXCLUSE_AR")),
        "general_supply_units": general,
        "special_supply_units": special,
        "model_supply_units": (general or 0) + (special or 0),
        "maximum_supply_price_10k_krw": number(row.get(
            "SUPLY_AMOUNT" if kind == "officetel" else "LTTOT_TOP_AMOUNT")),
    }


def notice_detail(kind, raw, models, category):
    model_rows = [model_detail(kind, row) for row in models]
    return {
        "source": "한국부동산원 청약홈 분양정보 조회 서비스",
        "source_id": key(raw)[0],
        "announcement_id": key(raw)[1],
        "category": category,
        "name_at_announcement": text(raw.get("HOUSE_NM")),
        "address_at_announcement": text(raw.get("HSSPLY_ADRES")),
        "announced_at": text(raw.get("RCRIT_PBLANC_DE")),
        "notice_supply_units": number(raw.get("TOT_SUPLY_HSHLDCO")),
        "model_supply_units_sum": sum(row["model_supply_units"] for row in model_rows),
        "builder": text(raw.get("CNSTRCT_ENTRPS_NM")),
        "business_entity": text(raw.get("BSNS_MBY_NM")),
        "planned_move_in_month": text(raw.get("MVN_PREARNGE_YM")),
        "official_notice_url": text(raw.get("PBLANC_URL")),
        "homepage_url": text(raw.get("HMPG_ADRES")),
        "schedule": {field: text(raw.get(field)) for field in SCHEDULE_FIELDS
                     if text(raw.get(field))},
        "models": model_rows,
    }


def distance_km(a, b):
    lat1, lon1 = math.radians(a["latitude"]), math.radians(a["longitude"])
    lat2, lon2 = math.radians(b["latitude"]), math.radians(b["longitude"])
    angle = 2 * math.asin(math.sqrt(math.sin((lat2 - lat1) / 2) ** 2
                                    + math.cos(lat1) * math.cos(lat2)
                                    * math.sin((lon2 - lon1) / 2) ** 2))
    return 6371.0088 * angle


def main():
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    models = json.loads(MODELS.read_text(encoding="utf-8"))
    candidates = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    preview = json.loads(PREVIEW.read_text(encoding="utf-8"))
    eligible = {(KIND_BY_CATEGORY[item["notice_category"]],
                 str(item["source_id"]), str(item["announcement_id"]))
                for item in candidates}
    model_by_kind = {}
    for kind, rows in models.items():
        groups = defaultdict(list)
        for row in rows:
            groups[key(row)].append(row)
        model_by_kind[kind] = groups

    notice_details = {}
    for kind, rows in raw.items():
        notice_details[kind] = {}
        for row in rows:
            if (kind, *key(row)) not in eligible:
                continue
            category = ("APT 불법행위 재공급 공고"
                        if kind == "remaining" and row.get("HOUSE_SECD_NM") == "불법행위 재공급"
                        else {"apartment": "APT 일반 분양공고",
                              "officetel": "오피스텔 분양공고",
                              "remaining": "APT 무순위 공고",
                              "discretionary": "APT 임의공급 공고"}[kind])
            model_rows = model_by_kind[kind].get(key(row), [])
            if not model_rows:
                raise SystemExit(f"{kind}: models missing for {key(row)}")
            notice_details[kind][key(row)] = notice_detail(kind, row, model_rows, category)

    projects = []
    missing = []
    for project in preview:
        notices = []
        for ref in project["source_notices"]:
            kind = KIND_BY_CATEGORY[ref["category"]]
            identity = str(ref["source_id"]), str(ref["announcement_id"])
            notice = notice_details[kind].get(identity)
            if notice is None:
                missing.append({"project": project["name"], "kind": kind,
                                "source_id": identity[0], "announcement_id": identity[1]})
                continue
            notices.append(notice)
        notices.sort(key=lambda row: (row["announced_at"] or "").replace("-", ""),
                     reverse=True)
        projects.append({
            "name": project["name"],
            "address": project["address"],
            "latitude": project["latitude"],
            "longitude": project["longitude"],
            "product_type": project["product_type"],
            "source_notices": notices,
            "nearby_planned_move_in": [],
        })
    if missing:
        raise SystemExit(json.dumps({"missing_notices": missing[:10],
                                     "count": len(missing)}, ensure_ascii=False))

    today_month = STAMP[:7].replace("-", "")
    for project in projects:
        nearby = []
        for other in projects:
            if other is project:
                continue
            months = [str(n["planned_move_in_month"]).replace("-", "")
                      for n in other["source_notices"] if n["planned_move_in_month"]]
            future = sorted(month for month in months if len(month) == 6 and month >= today_month)
            if not future:
                continue
            distance = distance_km(project, other)
            if distance <= 3:
                nearby.append({"name": other["name"], "address": other["address"],
                               "planned_move_in_month": future[0],
                               "straight_line_distance_km": round(distance, 2)})
        project["nearby_planned_move_in"] = sorted(
            nearby, key=lambda row: (row["straight_line_distance_km"], row["name"]))

    all_notices = [notice for project in projects for notice in project["source_notices"]]
    full_notices = [{"kind": kind, **notice}
                    for kind, group in notice_details.items() for notice in group.values()]
    counts = Counter({
        "projects": len(projects),
        "collected_notices": len(full_notices),
        "collected_models": sum(len(n["models"]) for n in full_notices),
        "joined_notices": len(all_notices),
        "joined_models": sum(len(n["models"]) for n in all_notices),
        "notices_with_builder": sum(bool(n["builder"]) for n in all_notices),
        "notices_with_business_entity": sum(bool(n["business_entity"]) for n in all_notices),
        "notices_with_move_in": sum(bool(n["planned_move_in_month"]) for n in all_notices),
        "models_with_price": sum(m["maximum_supply_price_10k_krw"] is not None
                                 for n in all_notices for m in n["models"]),
        "all_notices_with_builder": sum(bool(n["builder"]) for n in full_notices),
        "all_notices_with_business_entity": sum(bool(n["business_entity"])
                                                for n in full_notices),
        "all_notices_with_move_in": sum(bool(n["planned_move_in_month"])
                                        for n in full_notices),
        "all_models_with_price": sum(m["maximum_supply_price_10k_krw"] is not None
                                     for n in full_notices for m in n["models"]),
        "supply_count_mismatches": sum(
            n["notice_supply_units"] is not None
            and n["notice_supply_units"] != n["model_supply_units_sum"]
            for n in all_notices),
        "projects_with_nearby_planned_move_in": sum(bool(p["nearby_planned_move_in"])
                                                   for p in projects),
    })
    NOTICE_OUTPUT.write_text(json.dumps(full_notices, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
    OUTPUT.write_text(json.dumps(projects, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with SUMMARY.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=(
            "현장명", "주소", "상품", "공고수", "주택형수", "주택형", "공고공급세대수",
            "주택형별공급세대수합", "주택형별최고분양가_최저_만원",
            "주택형별최고분양가_최고_만원", "사업주체", "시공사",
            "최근공고일", "입주예정월", "반경3km_입주예정현장수"))
        writer.writeheader()
        for project in projects:
            notices = project["source_notices"]
            latest = notices[0]
            model_rows = latest["models"]
            prices = [model["maximum_supply_price_10k_krw"] for model in model_rows
                      if model["maximum_supply_price_10k_krw"] is not None]
            writer.writerow({
                "현장명": project["name"], "주소": project["address"],
                "상품": project["product_type"], "공고수": len(notices),
                "주택형수": len(model_rows),
                "주택형": " · ".join(sorted({m["type"] for m in model_rows if m["type"]})),
                "공고공급세대수": latest["notice_supply_units"],
                "주택형별공급세대수합": latest["model_supply_units_sum"],
                "주택형별최고분양가_최저_만원": min(prices) if prices else "",
                "주택형별최고분양가_최고_만원": max(prices) if prices else "",
                "사업주체": latest["business_entity"] or "",
                "시공사": latest["builder"] or "",
                "최근공고일": latest["announced_at"] or "",
                "입주예정월": latest["planned_move_in_month"] or "",
                "반경3km_입주예정현장수": len(project["nearby_planned_move_in"]),
            })
    REPORT.write_text(json.dumps({"collected_at": STAMP, "counts": counts,
                                  "nearby_rule": "other reviewed projects within 3 km straight line; planned month is not verified current schedule",
                                  "database_writes": 0}, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main()
