# 미분양 여부 지역별 수집

첫 지역은 경기도. 경기도청 주택정책과의 2026-08-31 기준 자료를 원본 그대로 보존한다. 기준월과 출처가 있는 미분양 확인 정보만 저장하며, 잔여 세대수나 연락처는 서비스에 복사하지 않는다.

수집 자료의 원본 시트 `업체별 현황 `의 당해월 O열이 양수인 사업지만 대상으로 한다. 소계 이후 익명 사업지가 앞 사업지 주소를 이어받지 않도록 분리한다. 시·군, 동·읍·리, 지번(산 여부 포함), 공급유형이 일치하는 단일 기존 현장만 연결한다. 특정 동만 등록된 현장, 비공개 주소, 다중 후보는 보류한다.

원본에 없거나 0으로 기재됐다는 이유로 분양 완료를 표시하지 않는다. 입주 예정이나 무순위 공고만으로 미분양을 추정하지 않는다. 미분양 확인은 출처 기준월 당시의 정보다.

실행 예:

    python3 -B research/unsold/collect_gyeonggi_unsold.py --xlsx research/unsold/gyeonggi_unsold_source_2026-08.xlsx --projects research/unsold/gyeonggi_existing_projects_2026-10-01.json --output research/unsold

    python3 -B -m unittest discover -s research/unsold -p test_gyeonggi_unsold.py

원본: https://www.gg.go.kr/bbs/boardView.do?bsIdx=551&bIdx=266126616&menuId=1799

보고서의 주소 묶음 수는 검토 단위로 고유 현장 수가 아니다. 보류 자료는 추후 주소·현장 동일성 확인 및 신규 현장 좌표 확인이 필요하다. 수집 스크립트는 DB에 쓰지 않는다.
