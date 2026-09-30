import openpyxl,pathlib,json,re,zipfile,xml.etree.ElementTree as ET
b=pathlib.Path(__file__).parent
configs=[('서울','seoul-20260831.xlsx','2026-07-31',4,14,2,3),('부산','busan-20260831.xlsx','2026-08-31',4,14,2,3),('대구','daegu-20260831.xlsx','2026-08-31',3,13,1,2),('울산','ulsan-20260831.xlsx','2026-08-31',3,13,1,2),('광주','gwangju-file2.xlsx','2026-07-31',4,14,2,3)]
positive=[];blocked=[];addresses=[]
urls={'서울':'https://land.seoul.go.kr/land/rent/rentCivilHouse.do','부산':'https://www.busan.go.kr/depart/absalesinfo/1756577','대구':'https://www.daegu.go.kr/build/index.do?bbsId=BBS_00153&menu_id=00001338&menu_link=/icms/bbs/selectBoardArticle.do&nttId=825402','울산':'https://www.ulsan.go.kr/u/metro/bbs/view.do?mId=001008005003000000&bbsId=BBS_0000000000000102&dataId=184232','광주':'https://www.gwangju.go.kr/build/boardView.do?boardId=BD_0000000288&pageId=build23&seq=528'}
for region,fn,date,addrcol,numcol,distcol,dongcol in configs:
 groups=[];mask=set()
 with zipfile.ZipFile(b/fn) as z:
  strings=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('{*}si'):strings.append(''.join(n.text or '' for n in si.findall('.//{*}t')))
  xml=ET.fromstring(z.read('xl/worksheets/sheet2.xml'))
  for mc in xml.findall('.//{*}mergeCell'):
   minc,minr,maxc,maxr=openpyxl.utils.range_boundaries(mc.attrib['ref'])
   for rr in range(minr,maxr+1):
    for cc in range(minc,maxc+1):
     if (rr,cc)!=(minr,minc):mask.add((rr,cc))
  rows={}
  for node in xml.findall('.//{*}sheetData/{*}row'):
   num=int(node.attrib['r']); vals=[None]*30
   for cell in node.findall('{*}c'):
    cc,rr=openpyxl.utils.cell.coordinate_from_string(cell.attrib['r']);col=openpyxl.utils.cell.column_index_from_string(cc)-1
    v=cell.find('{*}v');t=cell.attrib.get('t'); val=v.text if v is not None else None
    if t=='s' and val is not None:val=strings[int(val)]
    elif t=='inlineStr':val=''.join(n.text or '' for n in cell.findall('.//{*}t'))
    elif val is not None:
     try:val=float(val)
     except:pass
    vals[col]=val
   rows[num]=vals
 sheetname='업체별현황(최종)' if region in ['부산','광주'] else '업체별현황'
 cur=None;district='';dong=''
 for n,row in rows.items():
  row=tuple(None if (n,c+1) in mask else v for c,v in enumerate(row))
  if row[distcol] and not any(x in str(row[distcol]) for x in ['시군구','지역']):district=str(row[distcol]).strip()
  if row[dongcol]:dong=str(row[dongcol]).strip()
  if row[addrcol] and n>4:
   cur={'region':region,'district':district,'dong':dong,'location_raw':str(row[addrcol]).strip(),'source_date':date,'source_url':urls[region],'source_file':fn,'source_sheet':sheetname,'source_row':n,'positive':False,'hidden':False};groups.append(cur)
  if any(isinstance(x,str) and re.fullmatch(r'합\s*계|총\s*계',x.strip()) for x in row):cur=None
  if cur:
   v=row[numcol]
   if isinstance(v,(int,float)) and v>0 and (row[numcol-3] is not None or any(isinstance(x,str) and re.fullmatch(r'소\s*계',x.strip()) for x in row)):cur['positive']=True
   if any(isinstance(x,str) and '비공개' in x for x in row[11:15]):cur['hidden']=True
 for g in groups:
  names=re.findall(r'[\[\(]([^\]\)]+)[\]\)]',g['location_raw']);names=[x for x in names if not any(z in x for z in ['비공개','도시형','일대','번지','세대'])]
  g['name']=' '.join(names).replace('\n',' ').strip() if names else None
  if g['positive']:
   if g['name']:positive.append(g)
   else:addresses.append(g)
  elif g['hidden']:blocked.append(g)
 print(region,'positive named',sum(g['region']==region for g in positive),'address',sum(g['region']==region for g in addresses),'hidden',sum(g['region']==region for g in blocked))
(b/'confirmed-sites.json').write_text(json.dumps(positive,ensure_ascii=False,indent=2))
(b/'confirmed-addresses.json').write_text(json.dumps(addresses,ensure_ascii=False,indent=2))
(b/'withheld-candidates.json').write_text(json.dumps(blocked,ensure_ascii=False,indent=2))
for g in positive+addresses:print(g['region'],g['source_row'],g['location_raw'].replace('\n',' '))
