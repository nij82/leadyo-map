"""Retry only explicit parcel/road addresses embedded in failed source addresses."""
import json
import re
import time
from collections import Counter
from pathlib import Path

import requests
from geocode_project_review import credentials, ENDPOINT

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "project_geocoded_2026-09-29.json"
OUTPUT = HERE / "project_geocoded_fallback_2026-09-29.json"
PARCEL = re.compile(r"([가-힣]+(?:동|읍|면|리))\s*(산?\d+(?:-\d+)?)\s*번지?")
ROAD = re.compile(r"([가-힣0-9]+(?:로|길))\s*(\d+(?:-\d+)?)")


def alternate_query(address):
    city = " ".join(address.split()[:2])
    parcel = PARCEL.search(address)
    if parcel:
        return f"{city} {parcel.group(1)} {parcel.group(2)}"
    road = ROAD.search(address)
    if road:
        return f"{city} {road.group(1)} {road.group(2)}"
    return None


def main():
    groups = json.loads(SOURCE.read_text(encoding="utf-8"))
    session = requests.Session()
    session.headers.update(credentials())
    attempted = 0
    for group in groups:
        if group["geocoding"]["status"] != "no_match":
            continue
        query = alternate_query(group["address"])
        if not query:
            continue
        attempted += 1
        try:
            response = session.get(ENDPOINT, params={"query": query, "count": 3}, timeout=20)
            if response.status_code != 200:
                raise SystemExit(f"Geocoding HTTP {response.status_code}; 추가 조회를 중단했습니다.")
            payload = response.json()
            if payload.get("status") != "OK":
                raise SystemExit("Geocoding 응답 오류; 추가 조회를 중단했습니다.")
        except (requests.RequestException, ValueError):
            raise SystemExit("Geocoding 연결 또는 응답 오류; 추가 조회를 중단했습니다.") from None
        matches = payload.get("addresses", [])
        if len(matches) == 1:
            item = matches[0]
            group["geocoding"] = {
                "status": "one_match",
                "total_count": payload.get("meta", {}).get("totalCount", 1),
                "query_used": query,
                "matches": [{
                    "road_address": item.get("roadAddress"),
                    "jibun_address": item.get("jibunAddress"),
                    "latitude": float(item["y"]),
                    "longitude": float(item["x"]),
                }],
            }
        time.sleep(0.1)
    OUTPUT.write_text(json.dumps(groups, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"fallback_queries": attempted,
                      "results": dict(Counter(g["geocoding"]["status"] for g in groups)),
                      "published": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
