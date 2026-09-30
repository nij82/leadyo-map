import json,pathlib,re,hashlib
b=pathlib.Path(__file__).parent
sites=json.loads((b/'confirmed-sites.json').read_text());addresses=json.loads((b/'confirmed-addresses.json').read_text())
files=json.loads((b/'artifact-urls.json').read_text());files.update({'seoul-20260831.xlsx':'https://land.seoul.go.kr/land/common/downloadFileNm.do?filePath=%2Fmain%2Fhtrend%2F2026%2F&fileName=unsold_20260831.xlsx','busan-20260831.xlsx':'https://www.busan.go.kr/comm/getFile?srvcId=BBSTY1&upperNo=1756577&fileTy=ATTACH&fileNo=1','gwangju-file2.xlsx':'https://www.gwangju.go.kr/fileDownload.do?boardId=BD_0000000288&fileKey=BD_0000000288%7C528&fileSe=BB&fileSn=1&seq=528'})
manual={77:'라데사 포레 매곡',80:'신용공원 산이고운',89:'운암산공원 우미린 리버포레',99:'운암산진아리채 지역주택조합',128:'벨루미체 첨단',137:'광산센트럴파크 지역주택주합'}
rest=[]
for a in addresses:
 if a['region']=='광주' and a['source_row'] in manual:a['name']=manual[a['source_row']];sites.append(a)
 else:rest.append(a)
djnurl='https://www.daejeon.go.kr/urb/UrbNormalboardView.do?boardId=normal_0033&ntatcSeq=1521405595&menuSeq=1246'
for name,addr,district,pg in [('수펠리스','동구 가오동 596번지외1필지','동구',1),('선화동 에이스퀘어','중구 선화동 379-1 외 3필지','중구',1),('한국아델리움','중구 유천동 328-50번지 외 19필지','중구',1),('시티팰리스 8차','서구 갈마동 338-1번지','서구',1),('에코리움','서구 월평동 1638번지','서구',1),('엔터팰리스1차','유성구 봉명동 607-4','유성구',2),('스카이뷰리브','유성구 구암동 611-31','유성구',2),('휴안팰리스','유성구 봉명동 562-6','유성구',2)]:
 sites.append({'region':'대전','district':district,'name':name,'location_raw':addr,'source_date':'2026-07-31','source_url':djnurl,'source_file':'daejeon-20260731.pdf','source_sheet':'업체별 현황','source_page':pg,'positive':True,'hidden':False})
rest.append({'region':'대전','district':'서구','name':None,'location_raw':'서구 괴정동 52-11번지','source_date':'2026-07-31','source_url':djnurl,'source_file':'daejeon-20260731.pdf','source_page':1,'positive':True,'hidden':False})
def standard(g):
 g['address']=g['location_raw'].replace('\n',' ');g['as_of']=g['source_date'];g['file_url']=files.get(g['source_file']);g['local_file']=str((b/g['source_file']).resolve());g['provenance']={'sheet':g.get('source_sheet'),'row':g.get('source_row'),'page':g.get('source_page'),'date_basis':'file internal heading','sha256':hashlib.sha256((b/g['source_file']).read_bytes()).hexdigest()};g['confirmation']='official_unsold_positive_numeric';g.pop('positive',None)
 if g['region']=='서울' and '4.15.' in g['location_raw']:g['as_of']='2026-04-15';g['warning']='원문에 4.15.자 이후 업데이트 안됨 표시. 현재 미분양으로 취급 금지.'
 if g['region']=='서울' and '오피스텔' in g['name']:g['warning']='공식 민간 미분양표 수록이지만 단지명에 오피스텔 표시. 아파트 전용 목록에는 주택유형 추가 확인 필요.'
 return g
sites=[standard(g) for g in sites];rest=[standard(g) for g in rest]
(b/'confirmed-sites.json').write_text(json.dumps(sites,ensure_ascii=False,indent=2));(b/'confirmed-addresses.json').write_text(json.dumps(rest,ensure_ascii=False,indent=2))
review=[]
for region,date,publication,source,scope,lim in [
('서울','2026-07-31',None,'https://land.seoul.go.kr/land/rent/rentCivilHouse.do','named_project_level','파일명 20260831이지만 표 내부 2026.7.31. 현재. 엘리프미아역2단지는 원문에 4.15. 이후 업데이트 안됨. 공식 표에는 도시형 생활주택 및 오피스텔 이름 혼재.'),
('부산','2026-08-31','2026-09-28','https://www.busan.go.kr/depart/absalesinfo/1756577','partial_named_project_level','일부 사업주체 비공개. 숫자0 행도 수록되어 양수 확인한 공개 단지만 추출.'),
('대구','2026-08-31','2026-09-30','https://www.daegu.go.kr/build/index.do?bbsId=BBS_00153&menu_id=00001338&menu_link=/icms/bbs/selectBoardArticle.do&nttId=825402','names_published_counts_often_withheld','단지명·주소는 공개되나 미분양 숫자가 비공개인 행 다수. 동일 표에 0 단지도 있으므로 비공개 이름을 양수 확정으로 채택하지 않음.'),
('인천','2026-07-31','2026-08-21','https://www.incheon.go.kr/build/BU050301/3085562','aggregate_only_all_project_names_withheld','업체별표 32개 단지를 사업주체 비공개 요청으로 일괄 숨김. web 캐시에 8월 게시글이 보였지만 실제 목록과 상세 자료에서 검증 못해 7월 채택. 국토부 8월 지역집계는 존재.'),
('광주','2026-07-31','2026-09-01','https://www.gwangju.go.kr/build/boardView.do?boardId=BD_0000000288&pageId=build23&seq=528','partial_names_and_addresses','표는 전남광주통합특별시로 명칭 변경되었으나 동·서·남·북·광산 5구만 포함. 제목·파일 내부는7월인데 게시글 본문은6월 오기. 주소는 있지만 단지명이 없는 행도 있음. 게시글 공공누리4유형 상업이용금지/변경금지 표시.'),
('대전','2026-07-31','2026-09-01',djnurl,'partial_named_project_level','미공개 요청단지는 이름·주소 숨김. 공개된 일부는 도시형 생활주택. 임대행은 이번 명단 제외. 국토부8월집계가 더 최신.'),
('울산','2026-08-31','2026-09-30','https://www.ulsan.go.kr/u/metro/bbs/view.do?mId=001008005003000000&bbsId=BBS_0000000000000102&dataId=184232','names_published_counts_often_withheld','단지명은 공개되지만 사업자 요청으로 숫자 숨긴 행 존재. 합계0도 포함되어 숫자 미확인 단지는 보류.'),
('세종','2026-08-31','2026-09-30','https://www.molit.go.kr/USR/NEWS/m_71/dtl.jsp?id=95092469','national_aggregate_only_verified','시청은 web robots 제한 및 shell SSO unauthorized 응답. 국토부PDF 22쪽 세종 지역 미분양 양수 확인, 단지명·주소 없음. 단지별 공개자료 존재 여부 미확정.')]:
 review.append({'region':region,'as_of':date,'published_at':publication,'source_url':source,'disclosure':scope,'confirmed_named_sites':sum(g['region']==region for g in sites),'confirmed_address_only':sum(g['region']==region for g in rest),'limitations':lim,'reviewed_at':'2026-10-01','national_aggregate_as_of':'2026-08-31'})
(b/'region-reviews.json').write_text(json.dumps(review,ensure_ascii=False,indent=2));print('named',len(sites),'addresses',len(rest));print([(r['region'],r['confirmed_named_sites']) for r in review])
