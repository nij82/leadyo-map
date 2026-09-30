"""Fetch ApplyHome sale, remaining-unit, and discretionary notices for review.

Set APPLYHOME_SERVICE_KEY in service/.env.local, then run:
    python3 research/applyhome/fetch_current.py

No geocoding, database writes, or publication are performed.
"""
import json
import os
import urllib.parse

import requests
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENV_FILE = HERE.parents[1] / "service" / ".env.local"
API_ROOT = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1"
SOURCES = {
    "apartment": "getAPTLttotPblancDetail",
    "officetel": "getUrbtyOfctlLttotPblancDetail",
    "remaining": "getRemndrLttotPblancDetail",
    "discretionary": "getOPTLttotPblancDetail",
}
NOTICE_LABELS = {
    "apartment": "APT 일반 분양공고",
    "officetel": "오피스텔 분양공고",
    "remaining": "APT 무순위 공고",
    "discretionary": "APT 임의공급 공고",
}
START_DATE = "2025-01-01"
PAGE_SIZE = 500


def load_key():
    if os.getenv("APPLYHOME_SERVICE_KEY"):
        return urllib.parse.unquote(os.environ["APPLYHOME_SERVICE_KEY"].strip())
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            if line.startswith("APPLYHOME_SERVICE_KEY="):
                return urllib.parse.unquote(line.partition("=")[2].strip().strip('"').strip("'"))
    raise SystemExit("service/.env.local에 APPLYHOME_SERVICE_KEY를 설정해 주세요.")


def fetch(endpoint, key, start_date=START_DATE):
    rows = []
    page = 1
    while True:
        query = {"page": page, "perPage": PAGE_SIZE}
        if start_date is not None:
            query["cond[RCRIT_PBLANC_DE::GTE]"] = start_date
        params = urllib.parse.urlencode(query)
        url = f"{API_ROOT}/{endpoint}?{params}"
        try:
            response = requests.get(
                url,
                headers={"Authorization": f"Infuser {key}", "Accept": "application/json"},
                timeout=30,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.HTTPError as error:
            raise SystemExit(f"{endpoint}: HTTP {error.response.status_code}; 인증키와 API 활용신청 상태를 확인해 주세요.") from None
        except (requests.RequestException, ValueError) as error:
            raise SystemExit(f"{endpoint}: API 응답을 읽지 못했습니다. {type(error).__name__}") from None
        if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
            raise SystemExit(f"{endpoint}: 예상하지 못한 API 응답입니다.")
        rows.extend(payload["data"])
        total = payload.get("matchCount", payload.get("totalCount"))
        if not payload["data"] or (isinstance(total, int) and len(rows) >= total) or len(payload["data"]) < PAGE_SIZE:
            if isinstance(total, int) and len(rows) != total:
                raise SystemExit(f"{endpoint}: expected {total} rows, got {len(rows)}")
            break
        page += 1
    return rows


def normalize(kind, rows):
    product_type = "officetel" if kind == "officetel" else "apartment"
    seen = set()
    result = []
    for row in rows:
        if kind == "apartment" and str(row.get("RENT_SECD") or "") == "1":
            continue
        if product_type == "officetel" and str(row.get("HOUSE_DTL_SECD_NM") or "").strip() != "오피스텔":
            continue
        source_id = str(row.get("HOUSE_MANAGE_NO") or "").strip()
        notice_id = str(row.get("PBLANC_NO") or "").strip()
        name = str(row.get("HOUSE_NM") or "").strip()
        address = str(row.get("HSSPLY_ADRES") or "").strip()
        announced = str(row.get("RCRIT_PBLANC_DE") or "").strip()
        if not source_id or not name or not address or not announced:
            continue
        identity = (kind, source_id, notice_id)
        if identity in seen:
            continue
        seen.add(identity)
        units_text = str(row.get("TOT_SUPLY_HSHLDCO") or "").strip()
        category = ("APT 불법행위 재공급 공고"
                    if kind == "remaining" and str(row.get("HOUSE_SECD_NM") or "").strip() == "불법행위 재공급"
                    else NOTICE_LABELS[kind])
        result.append({
            "source": "한국부동산원 청약홈 분양정보 조회 서비스",
            "source_id": source_id,
            "announcement_id": notice_id,
            "product_type": product_type,
            "notice_category": category,
            "unsold_status": "unverified",
            "name": name,
            "address": address,
            "announced_at": announced,
            "units": int(units_text) if units_text.isdigit() and kind in ("apartment", "officetel") else None,
            "notice_supply_units": int(units_text) if units_text.isdigit() and kind in ("remaining", "discretionary") else None,
            "move_in": str(row.get("MVN_PREARNGE_YM") or "").strip() or None,
            "builder": (str(row.get("CNSTRCT_ENTRPS_NM") or "").strip() or None)
            if kind == "apartment" else None,
            "latitude": None,
            "longitude": None,
            "location_status": "needs_verification",
        })
    return result


def main():
    key = load_key()
    if not key:
        raise SystemExit("APPLYHOME_SERVICE_KEY가 비어 있습니다.")
    raw = {kind: fetch(endpoint, key) for kind, endpoint in SOURCES.items()}
    candidates = [item for kind, rows in raw.items() for item in normalize(kind, rows)]
    stamp = date.today().isoformat()
    (HERE / f"applyhome_raw_{stamp}.json").write_text(
        json.dumps(raw, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    output = HERE / f"applyhome_candidates_{stamp}.json"
    output.write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "raw": {kind: len(rows) for kind, rows in raw.items()},
        "review_candidates": len(candidates),
        "output": str(output),
        "published": False,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
