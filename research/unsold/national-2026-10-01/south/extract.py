import openpyxl,json,re,hashlib
from pathlib import Path
P=Path(__file__).parent
sources=[
('전남','jeonnam-2026-05.xlsx','2026-05-31','2026-07-20','https://www.jeonnam.go.kr/M5004/boardView.do?boardId=M5004&menuId=jeonnam0505040000&seq=1867164','https://www.jeonnam.go.kr/boardDown.do?boardId=M5004&seq=1867164&fileLinkTp=F&fileLinkSeq=1',3,11),
('경북','gyeongbuk-2026-07.xlsx','2026-07-31','2026-09-03','https://www.gb.go.kr/Main/economy/page.do?mnu_uid=15367&BD_CODE=economy_file_new&cmd=2&B_NUM=514886201&B_STEP=514886200','https://www.gb.go.kr/Common/board_egov/download.jsp?B_STEP=514886200&B_ORDER=1',4,14),
('경남','gyeongnam-2026-08.xlsx','2026-08-31','2026-09-15','https://gis.gyeongnam.go.kr/srp/unsoldAptStat.do','https://gis.gyeongnam.go.kr/srp/unsold/51/20260915-082141332_727.xlsx',3,13),
('제주','jeju-2026-07.xlsx','2026-07-31','2026-09-02','https://www.jeju.go.kr/news/news/data.htm?act=view&seq=2032614','https://www.jeju.go.kr/news/news/data.htm?act=download&seq=2032614&no=1',2,10)]
result=[];reviews=[]
def clean(x):return re.sub(r'\s+',' ',str(x)).strip() if x is not None else ''
for region,n,date,published,src,fil,ad,col in sources:
 w=openpyxl.load_workbook(P/n,data_only=True);regional=[];private=0
 sheets=list(w) if region=='제주' else [w.worksheets[1]]
 for s in sheets:
  groups=[];g=None;city='';local=''
  for idx,r in enumerate(s.values,1):
   if idx<5:continue
   ci=1 if region in ['전남','경남','제주'] else 2
   if r[ci] and r[ci] not in ['소재지','시군구']:city=clean(r[ci])
   li=2 if region in ['전남','경남'] else 3
   if region!='제주' and r[li]:local=clean(r[li])
   if r[ad] is not None and clean(r[ad]) and (region!='제주' or isinstance(r[0],(int,float))):
    if g:groups.append(g)
    g={'row':idx,'raw':r[ad],'city':city,'local':local, 'rows':[],'positive_rows':[],'private':False}
   if g:
    g['rows'].append(idx)
    if any('비공개' in clean(v) for v in r):g['private']=True
    if isinstance(r[col],(int,float)) and r[col]>0:g['positive_rows'].append(idx)
  if g:groups.append(g)
  for g in groups:
   if g['private']:private+=1;continue
   if not g['positive_rows']:continue
   raw=str(g['raw']).strip();name=None
   if region=='제주':
    parts=re.split(r'\n?\(',raw,maxsplit=1);addr=parts[0].strip();name=parts[1].rstrip(') ').strip() if len(parts)>1 else None
    addr='제주특별자치도 '+g['city']+' '+addr
   elif region=='전남':addr='전라남도 '+g['city']+' '+('' if g['local'] in raw else g['local']+' ')+clean(raw)
   elif region=='경북':
    matches=re.findall(r'\(([^()]*)\)',raw)
    candidates=[x for x in matches if not re.search(r'번지|=>|일원',x)]
    addr=raw
    if candidates:
     name=candidates[-1].strip();addr=addr.replace('('+candidates[-1]+')','').strip()
    elif '\n' in raw and not re.search(r'동|읍|면|리|경상북도|번지',raw.split('\n')[0]):
     name=raw.split('\n')[0].strip();addr=' '.join(raw.split('\n')[1:]).strip()
    if not addr.startswith('경상북도'):
     addr='경상북도 '+('' if g['city'] in addr else g['city']+' ')+('' if g['local'] in addr else g['local']+' ')+addr
    addr=clean(addr)
   else:
    lines=[x.strip() for x in raw.split('\n') if x.strip()];addr=lines[0];name=lines[-1].strip('() ') if len(lines)>1 else None
    if not addr.startswith('경상남도'):addr='경상남도 '+(g['city']+' ' if g['city'] not in addr else '')+addr
   site={'region':region,'name':name,'address':clean(addr),'source_address_raw':raw,'as_of':date,'published_at':published,'source_url':src,'file_url':fil,'local_file':str((P/n).resolve()),'provenance':{'sheet':s.title,'project_start_row':g['row'],'positive_unsold_rows':g['positive_rows'],'unsold_column':openpyxl.utils.get_column_letter(col+1)},'confirmation':'공식 공개 원본의 당월 미분양 열에 양수 확인; 비공개 요청 사업장 제외','unsold_positive':True,'name_missing':name is None}
   site['address']=site['address'].replace('창원시 진해구 진해구 ','창원시 진해구 ',1)
   regional.append(site)
 result+=regional
 reviews.append({'region':region,'reviewed_at':'2026-10-01','as_of':date,'published_at':published,'source_url':src,'file_url':fil,'local_file':str((P/n).resolve()),'sha256':hashlib.sha256((P/n).read_bytes()).hexdigest(),'file_inspected':True,'project_level':True,'confirmed_positive_sites':len(regional),'excluded_private_blocks':private,'blockers':(['단지명 열 없음; 주소 기준 식별'] if region=='전남' else ['일부 단지는 주소만 공개; 사업자 비공개 요청 블록 제외'] if region=='경북' else [])})
(P/'confirmed-sites.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
(P/'region-reviews.json').write_text(json.dumps(reviews,ensure_ascii=False,indent=2))
print([(x['region'],x['confirmed_positive_sites'],x['excluded_private_blocks']) for x in reviews])
