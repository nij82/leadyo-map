import pathlib,json
b=pathlib.Path(__file__).parent;reviews=json.loads((b/'region-reviews.json').read_text());sites=json.loads((b/'confirmed-sites.json').read_text());addresses=json.loads((b/'confirmed-addresses.json').read_text())
lines=['# 광역시·세종 미분양 공식자료 검토','', '검토일: 2026-10-01. 범위: 서울·부산·대구·인천·광주·대전·울산·세종. DB 수정 없음. 공식 지자체 게시판·원본 첨부자료와 국토부 원문 PDF만 사용했다. 분양 광고·청약 미달·상가 미분양은 근거로 사용하지 않았다.','', '국토부 [2026년 8월 주택통계](https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp?id=95092469)는 2026-09-30 공표되었으며 원본 PDF 22쪽에 2026-08-31 지역별 미분양 집계를 제공한다. 모든 지역의 최신 지역집계는 8월이지만 단지별 공개자료 최신월은 아래와 다르다. 해당 PDF는 `molit-202608.pdf`로 보관했다.','', '| 지역 | 단지별 검증 기준일 | 공개 형태 | 이름·양수 확인 | 주소만 확인 | 공식 링크 |','|---|---|---|---:|---:|---|']
for r in reviews:lines.append(f"| {r['region']} | {r['as_of']} | {r['disclosure']} | {r['confirmed_named_sites']} | {r['confirmed_address_only']} | [원문]({r['source_url']}) |")
lines+=['', '## 해석과 공개 한계','']
for r in reviews:lines.append(f"- **{r['region']}**: {r['limitations']} ([출처]({r['source_url']}))")
lines+=['','숫자 미공개 단지는 이름이 공식표에 있더라도 미분양 양수 확정 명단에서 제외했다. 같은 표에 이미 미분양 0인 단지가 포함되어 있기 때문이다. `withheld-candidates.json`은 검토 후보이며 등록 확정 목록이 아니다. 공개 숫자의 세부행 또는 해당 단지 소계가 양수인 경우만 확정했다.','', '서울 엘리프미아역2단지는 원문이 4월15일 이후 업데이트하지 않았다고 명시하므로 JSON `as_of`를 2026-04-15로 내려 기록했다. 서울 천호아스하임오피스텔은 공식 민간 미분양표 수록을 확인한 상태이며 아파트 전용 목록에 바로 반영하면 안 된다.','', '광주 공공누리4유형 제한은 게시글에서 확인했다. 자료를 서비스에 상업적으로 재사용할지 결정할 때 별도 검토가 필요하다. 광주 명칭이 통합시로 바뀐 공식 파일이지만 업체별 행은 기존 광주 5구 범위로만 분류했다.','', '## 이름이 있는 공개 확인 단지','', '| 지역 | 단지명(원문) | 원문 주소 | 기준일 | 첨부 위치 |','|---|---|---|---|---|']
for g in sites:
 pos=f"{g.get('source_sheet','')} {g.get('source_row','')}행" if g.get('source_row') else f"PDF {g.get('source_page')}쪽"
 lines.append(f"| {g['region']} | {g['name'].replace('|','/')} | {g['address'].replace('|','/')} | {g['as_of']} | {pos} |")
lines+=['','## 이름 없는 주소 확인','', '단지명을 임의로 보완하지 않았다. 같은 주소에 다른 분양 블록이 존재할 수 있으므로 원문 행번호를 유지했다.','', '| 지역 | 주소 | 첨부 위치 |','|---|---|---|']
for g in addresses:lines.append(f"| {g['region']} | {g['address']} | {g.get('source_sheet','PDF')} {g.get('source_row',g.get('source_page'))} |")
lines+=['', '## 산출물','', '- `confirmed-sites.json`: 단지명, 공개 주소, 내부 기준일, 원문/파일 링크, 원본 SHA-256, 시트·행 또는 PDF 쪽을 기록한 확인 목록.', '- `confirmed-addresses.json`: 이름 없이 주소로만 확인 가능한 양수 사업장.', '- `region-reviews.json`: 8개 지역의 검토 상태와 공개 제한.', '- `withheld-candidates.json`: 명칭·주소가 공개되었지만 숫자 미확인인 별도 보류 후보.', '- 원본 XLS/XLSX/PDF 및 게시판 HTML을 동일 폴더에 저장. 다운로드 실패 응답 파일도 400응답 증거로 남아 있으며 확정 출처는 JSON `local_file`에 표시한 정상 원본이다.', '', '기준월을 파일명으로 추정하지 않았고 원문 내부 제목을 확인했다. 이번 연구는 공식자료 기준 미분양 여부 확인이며 2026-10-01 현재 개별 현장 실제 잔여 재고 또는 모집 영업 여부를 확인한 것은 아니다.']
(b/'research.md').write_text('\n'.join(lines))
