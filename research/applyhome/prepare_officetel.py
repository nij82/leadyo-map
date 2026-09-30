"""Prepare review-only officetel records from the official ApplyHome CSV.

Usage: python3 research/applyhome/prepare_officetel.py
No database writes or geocoding are performed.
"""
import csv
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "officetel_2026-08-18.csv"
OUTPUT = HERE / "officetel_2025-2026_candidates.json"

with SOURCE.open(encoding="cp949", newline="") as source:
    rows = list(csv.DictReader(source))

seen = set()
items = []
for row in rows:
    if row["주택상세구분코드명"].strip() != "오피스텔":
        continue
    source_id = row["주택관리번호"].strip()
    if not source_id or source_id in seen:
        continue
    seen.add(source_id)
    announced = row["모집공고일"].strip()
    if not announced.startswith(("2025-", "2026-")):
        continue
    name = row["주택명"].strip()
    address = row["공급위치"].strip()
    if not name or not address:
        continue
    units_text = row["공급규모"].strip()
    items.append({
        "source": "한국부동산원 청약홈 오피스텔 분양정보",
        "source_id": source_id,
        "announcement_id": row["공고번호"].strip(),
        "product_type": "officetel",
        "name": name,
        "address": address,
        "announced_at": announced,
        "units": int(units_text) if units_text.isdigit() else None,
        "move_in": row["입주예정월"].strip() or None,
        "latitude": None,
        "longitude": None,
        "location_status": "needs_verification",
    })

OUTPUT.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"source_rows": len(rows), "candidate_rows": len(items), "output": str(OUTPUT)}, ensure_ascii=False))
