"""Prepare a review-only catalog from the official ApplyHome APT CSV.

Usage: python3 research/applyhome/prepare_apt.py
No database writes or geocoding are performed.
"""
import csv
import json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "apt_2025-11-28.csv"
OUTPUT = HERE / "apt_2025_candidates.json"

with SOURCE.open(encoding="cp949", newline="") as source:
    rows = list(csv.DictReader(source))

seen = set()
items = []
for row in rows:
    source_id = row["주택관리번호"].strip()
    if not source_id or source_id in seen:
        continue
    seen.add(source_id)
    announced = row["모집공고일"].strip()
    if not announced.startswith("2025-"):
        continue
    name = row["주택명"].strip()
    address = row["공급위치"].strip()
    if not name or not address:
        continue
    units_text = row["공급규모"].strip()
    items.append({
        "source": "한국부동산원 청약홈 APT 분양정보",
        "source_id": source_id,
        "announcement_id": row["공고번호"].strip(),
        "name": name,
        "address": address,
        "announced_at": announced,
        "units": int(units_text) if units_text.isdigit() else None,
        "move_in": row["입주예정월"].strip() or None,
        "builder": row["건설업체명_시공사"].strip() or None,
        "latitude": None,
        "longitude": None,
        "location_status": "needs_verification",
    })

OUTPUT.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "source_rows": len(rows),
    "years": dict(sorted(Counter(row["모집공고일"].strip()[:4] for row in rows).items())),
    "candidate_rows": len(items),
    "output": str(OUTPUT),
}, ensure_ascii=False))
