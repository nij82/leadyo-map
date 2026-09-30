"""Geocode review groups with NAVER Maps; save candidates only, never publish."""
import json
import time
from collections import Counter
from pathlib import Path

import requests

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "project_review_2026-09-29.json"
OUTPUT = HERE / "project_geocoded_2026-09-29.json"
ENDPOINT = "https://maps.apigw.ntruss.com/map-geocode/v2/geocode"


def credentials():
    values = {}
    for line in (HERE.parents[1] / "service" / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value.strip().strip('"').strip("'")
    keys = ("NAVER_GEOCODING_CLIENT_ID", "NAVER_GEOCODING_CLIENT_SECRET")
    if not all(values.get(key) for key in keys):
        raise SystemExit("네이버 Geocoding 인증정보가 없습니다.")
    return {
        "X-NCP-APIGW-API-KEY-ID": values[keys[0]],
        "X-NCP-APIGW-API-KEY": values[keys[1]],
        "Accept": "application/json",
    }


def save(rows):
    temporary = OUTPUT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)


def main():
    groups = json.loads(SOURCE.read_text(encoding="utf-8"))
    if OUTPUT.exists():
        completed = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if len(completed) > len(groups) or any(a["address"] != b["address"] or a["product_type"] != b["product_type"] for a, b in zip(completed, groups)):
            raise SystemExit("기존 좌표 검토 파일과 입력 목록이 달라 중단했습니다.")
        groups[:len(completed)] = completed
    else:
        completed = []
    session = requests.Session()
    session.headers.update(credentials())
    for index in range(len(completed), len(groups)):
        group = groups[index]
        for attempt in range(3):
            try:
                response = session.get(ENDPOINT, params={"query": group["address"], "count": 3}, timeout=20)
                if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                if response.status_code != 200:
                    raise SystemExit(f"Geocoding HTTP {response.status_code}; {index}건까지 저장했습니다.")
                payload = response.json()
                if payload.get("status") != "OK":
                    raise SystemExit(f"Geocoding 응답 오류; {index}건까지 저장했습니다.")
                matches = payload.get("addresses", [])
                group["geocoding"] = {
                    "status": "one_match" if len(matches) == 1 else "no_match" if not matches else "multiple_matches",
                    "total_count": payload.get("meta", {}).get("totalCount", len(matches)),
                    "matches": [
                        {"road_address": item.get("roadAddress"),
                         "jibun_address": item.get("jibunAddress"),
                         "latitude": float(item["y"]),
                         "longitude": float(item["x"])}
                        for item in matches
                    ],
                }
                break
            except (requests.RequestException, ValueError, KeyError, TypeError):
                if attempt == 2:
                    raise SystemExit(f"Geocoding 연결 또는 응답 오류; {index}건까지 저장했습니다.") from None
                time.sleep(2 ** attempt)
        if (index + 1) % 50 == 0 or index + 1 == len(groups):
            save(groups[:index + 1])
            print(f"{index + 1}/{len(groups)} processed", flush=True)
        time.sleep(0.1)
    print(json.dumps({"results": dict(Counter(g["geocoding"]["status"] for g in groups)), "published": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
