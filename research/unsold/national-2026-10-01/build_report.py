"""Assemble the dated all-region research review without changing the service."""
import json
from collections import Counter
from pathlib import Path

BASE=Path(__file__).parent
load=lambda p:json.loads((BASE/p).read_text())
reviews=[r for group in ('metro','central','south') for r in load(group+'/region-reviews.json')]
assert len(reviews)==16 and len({r['region'] for r in reviews})==16
matched=load('matched-existing.json'); held=load('held-identity-review.json'); summary=load('matching-summary.json')
counts=Counter(r['region'] for r in matched)
source_counts=summary['source_region_counts']
lines=['# 경기도 외 전국 미분양 공식 자료 검토', '',
       '검토일: 2026-10-01. 서울·부산·대구·인천·광주·대전·울산·세종·강원·충북·충남·전북·전남·경북·경남·제주 16개 지역을 검토했다. 기존 서비스의 지역 구분을 사용했다.', '',
       '## 요약', '',
       f"- 공개 사업장 근거 {summary['source_records']}건 추출. 미분양 수량은 서비스용 결과에 저장하지 않았다.",
       f"- 현재 공개 현장 {summary['existing_projects']}개와 대조해 현장 연결 후보 {len(matched)}개를 확인했다.",
       '- 247건은 기존 현장과 단일 명칭·주소 일치를 확인하지 못했다. 3건은 아파트 외 유형, 1건은 업데이트 중단 주석으로 연결 대상에서 제외했다.',
       '- 단지명·주소·수량 비공개 행은 위 278건에 포함되지 않는다. 따라서 278건은 전국 미분양 단지 총수가 아니다.',
       '- 이번 작업은 수집·대조·검토다. 서비스 DB 수정·신규 현장 등록·미분양 표시 반영은 0건이다.', '',
       '## 확인 기준', '',
       '1. 공식 첨부의 당월 미분양 값이 양수인 사업장을 추출했다. 수량 비공개라도 공식 미분양 단지 명부에 실명으로 등재된 전북 10곳은 명부 등재를 별도 근거로 기록했다.',
       '2. 동일 표에 0인 현장도 섞여 있는 경우, 수량 비공개 행을 미분양 있음으로 확정하지 않았다.',
       '3. 이름·주소는 원문을 보존했다. 지역·구·동이 별도 열이면 원문 열을 합쳐 주소를 구성했다. 시군구와 지번/도로명주소가 단일 기존 현장과 일치하거나, 동일 지역·명칭·행정구역이며 지번 충돌이 없는 경우 연결 후보로 분류했다.',
       '4. 산 지번과 일반 지번을 구분하고, 여러 현장이 같은 주소에 있으면 자동 연결하지 않는다. 연결 후보는 유형·공고 회차 및 재사용 조건까지 확인한 뒤 서비스에 반영해야 한다.',
       '5. 원문 기준월 당시의 존재 근거다. 오늘의 미분양 상태나 잔여세대 수를 보장하지 않는다. 자료에 없거나 0이어도 분양 완료로 표시하지 않는다.', '',
       '## 지역별 검토', '',
       '| 지역 | 단지 자료 기준일 | 공개 근거 사업장 | 기존 현장 연결 후보 | 공식 출처 및 제한 |',
       '|---|---|---:|---:|---|']
for r in reviews:
    limit=r.get('limitations') or '; '.join(r.get('blockers',[])) or '공개 단지별 원본 검사 완료'
    limit=limit.replace('|','/')
    lines.append(f"| {r['region']} | {r['as_of']} | {source_counts.get(r['region'],0)} | {counts.get(r['region'],0)} | [공식 자료]({r['source_url']}) — {limit} |")
lines+=['', '## 전국 집계와 단지별 자료의 차이', '',
         '[국토교통부 통계누리](https://stat.molit.go.kr/portal/cate/statMetaView.do?hRsId=32)의 2026년 8월 말 XLSX 원본을 내려받아 검사했다. 이 자료는 지역·시군구 집계이며 단지별 근거로 사용하지 않았다. 총괄 시트는 최신 열에 전남광주를 합쳐 기재하고 광주·전남 개별 행을 비워 두므로 빈칸을 0으로 해석하거나 각각에 합계 수치를 복사하지 않았다.', '',
         '지자체 단지별 공개자료의 기준일은 5~8월로 다르다. 서울 파일명은 8월이지만 파일 내부 기준일은 7월이다. 최신 파일명·검색 캐시만으로 기준월을 결정하지 않았다.', '',
         '## 연결 후보 현장', '',
         '| 지역 | 리드요 현장명 | 근거 기준일 | 연결 방법 | 원문 출처 |',
         '|---|---|---|---|---|']
for r in matched:
    lines.append(f"| {r['region']} | {r['project_name']} | {r['as_of']} | {r['match_method']} | [공식 근거]({r['source_url']}) |")
lines+=['', '## 남은 확인과 활용', '',
         '- 인천: 단지명·주소 전체 비공개. 지역 집계에서 특정 단지를 추정하지 않는다.',
         '- 세종: 국토부 8월 지역 집계는 확인했으나 단지별 공개 자료는 확인하지 못했다. 시청 접근 응답 제한을 기록했다.',
         '- 충남: 최신 도 게시물 목록은 확인했으나 상세 웹방화벽으로 원본을 확인하지 못했다. 아산 최신 첨부는 집계만 제공한다.',
         '- 미연결 247건: 오래된 준공 단지, 기존 목록 밖 단지, 원문 이름 누락, 주소 형식 차이 등이 있을 수 있다. 이번 결과에서는 원인별 추정을 확정으로 쓰지 않았으며 개별 명칭·주소 검색 대조가 필요하다.',
         '- 광주·전북 공식 게시물은 공공누리 상업적 이용 금지·변경 금지 조건이 확인됐다. 연구 원본 보존과 상업 서비스 재사용 승인은 별개이므로 반영 전 사용 가능한 근거를 확인해야 한다.', '',
         '## 검증·산출물', '',
         '- 지역별 검토 JSON 16개 지역, 3개 연구 보고서, 공개 XLSX/PDF 원본 및 행·셀·쪽 근거 보존.',
         '- 804개 공개 현장 DB를 읽기 전용 조회. 기존 경기도 미분양 근거 17개 확인.',
         '- 광주 동일 주소 사업장 두 원문 블록을 하나로 결합하고 원문 행 19·26을 함께 보존했다.',
         '- 주소 매칭 검증 5개 통과: 구 불일치, 다중 후보, 산 지번, 명칭 같지만 지번 충돌, 단일 지번 일치.',
         '- `matched-existing.json`: 기존 현장 연결 후보 및 project_id.',
         '- `held-identity-review.json`: 미연결·유형·갱신중단 항목.',
         '- `national-aggregate-review.json`: 지역 집계 확인. 서비스 단지별 근거로 사용 금지.',
         '- `metro/research.md`, `central/findings.md`, `south/findings.md`: 원문 검사와 접근 제한 상세.', '']
(BASE/'REVIEW_2026-10-01.md').write_text('\n'.join(lines))
(BASE/'region-reviews-all.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2)+'\n')
print({'regions':len(reviews),'source_records':summary['source_records'],'matched_candidates':len(matched),'held':len(held),'database_writes':0})
