"""Re-read every held public Naver detail, then compare explicit site identities."""
import json, math, re, time
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
STATE = ROOT / 'hold-review-2026-10-01.json'
URL = 'https://isale.land.naver.com/iSale/AjaxContent/'

def compact(s): return re.sub(r'[^가-힣a-z0-9]', '', __import__('unicodedata').normalize('NFKC', s).lower())
def locality(s):
    primary = re.sub(r'([가-힣]+)\d+동', r'\1동', s.split('(')[0])
    return [x for x in re.findall(r'[가-힣]+(?:시|군|구|동|읍|면|리)\b', primary) if not x.endswith('지구')]
def parcels(s):
    return set(re.findall(r'(?<!\d)(\d{1,4}-\d{1,4})(?!\d)',s)) | set(re.findall(r'(?<![\d-])(\d{1,4})\s*번지', s))
def block(s):
    return set(re.findall(r'([A-Z]?\d+)\s*(?:블록|BL\b)',s.upper()))
def phase(s):
    return set(re.findall(r'(\d+)\s*(?:차|단지)',__import__('unicodedata').normalize('NFKC',s)))
def distance(a,b):
    rad=math.pi/180
    x=math.sin((a['latitude']-b['latitude'])*rad/2)**2+math.cos(a['latitude']*rad)*math.cos(b['latitude']*rad)*math.sin((a['longitude']-b['longitude'])*rad/2)**2
    return 6371008.8*2*math.asin(min(1,math.sqrt(x)))
def identity(row, p):
    d=distance(row,p)
    if d>200: return False
    a,b=locality(row['address']),locality(p['address'])
    if not a or not b: return False
    # Same named administrative levels must agree; omitted levels may be road addresses.
    for suffix in ('시','군','구','동','읍','면','리'):
        x={v for v in a if v.endswith(suffix)};y={v for v in b if v.endswith(suffix)}
        if x and y and x!=y: return False
    if block(row['address']) and block(p['address']) and block(row['address'])!=block(p['address']): return False
    if phase(row['name']) and phase(p['name']) and phase(row['name'])!=phase(p['name']): return False
    same_name=compact(row['name'])==compact(p['name'])
    pa,pb=parcels(row['address']),parcels(p['address'])
    same_parcel=bool(pa & pb)
    same_block=bool(block(row['address'])) and block(row['address'])==block(p['address'])
    roads=lambda value:set(re.findall(r'([가-힣]+(?:로|길))\s*(\d+(?:-\d+)?)',value))
    same_road=bool(roads(row['address']) & roads(p['address']))
    if same_name:
        return same_parcel or same_block or same_road or compact(row['address'])==compact(p['address']) or (d<=100 and (not pa or not pb))
    return same_parcel

def run():
    scan=json.loads((ROOT/'comparison-progress.json').read_text())
    receipt=json.loads((ROOT/'comparison-registration-progress.json').read_text())
    existing=json.loads((ROOT/'hold-review-existing.json').read_text())
    rows_by_name={x['name']:x for x in scan['rows']}
    targets=[]
    for held in receipt['held']:
        r=rows_by_name[held['name']]
        targets.append(dict(name=held['name'],old_reason=held['reason'],source_url=r['review_source']['source_url'],coordinates=[r['latitude'],r['longitude']]))
    for held in scan['held']: targets.append(dict(**held,old_reason=held['reason'],coordinates=None))
    state=json.loads(STATE.read_text()) if STATE.exists() else dict(as_of='2026-10-01',total=len(targets),rows=[],error=None)
    session=requests.Session(); calls=0
    def post(data):
        nonlocal calls
        if calls: time.sleep(2)
        response=session.post(URL,data=data,timeout=25); calls+=1; response.raise_for_status()
        return ET.fromstring(response.text)
    def save():
        temp=STATE.with_suffix('.tmp');temp.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n');temp.replace(STATE)
    city_list=scan['cities']
    try:
        state['error']=None
        start=len(state['rows'])
        for target in targets[start:start+20]:
            ids=dict(re.findall(r'(build_dtl_cd|supp_cd)=(\d+)',target['source_url']))
            xml=post(dict(sy_ajax_content='SYComplexInfo',**ids))
            info=json.loads(xml.findtext('SYJson'))
            if any(str(info[k])!=v for k,v in ids.items()): raise ValueError('목록·상세 식별자 불일치')
            text=BeautifulSoup(xml.findtext('SYComplexContent') or '', 'html.parser').get_text(' ',strip=True)
            match=re.search(r'(?:분양주소|공급위치)\s+(.+?)\s+단지규모',text)
            address=match[1] if match else ''
            record=dict(name=info['build_nm'],address=address,source_url=target['source_url'],source_ids=ids,
                        old_name=target['name'],old_reason=target['old_reason'],naver_status=info.get('supp_proc_step_nm'),
                        supply_kind=info.get('supp_sclass'),move_in=info.get('move_in_date'),
                        collected_at=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(),outcome='held',reason=None)
            if not address.startswith('경기도 '): record['reason']='사업지 주소 확인 필요'
            elif info.get('bclass_nm')!='아파트' or '임대' in info.get('supp_sclass','') or '행복주택' in info['build_nm']:
                record.update(outcome='excluded',reason='임대 등 아파트 분양 비교 범위 밖')
            else:
                coords=target['coordinates']
                if not coords:
                    city=next((c for c in sorted(city_list,key=len,reverse=True) if address.startswith('경기도 '+c+' ')),None)
                    remainder=address[len('경기도 '+city+' '):] if city else ''
                    town=re.match(r'([가-힣]+(?:동|읍|면))\s',remainder)
                    if city and town:
                        listing=post(dict(sy_ajax_content='SYAreaComplexList',sy_sido='경기도',sy_gugun=city,sy_dong=town[1],bclass='IA01',sy_sort='0'))
                        items=json.loads(listing.findtext('SYComplexData'))['Data']
                        candidate=next((i for i in items if all(str(i[k])==v for k,v in ids.items())),None)
                        if candidate: coords=[float(candidate['ypos']),float(candidate['xpos'])]
                if not coords: record['reason']='공개 목록의 같은 식별자 좌표 확인 필요'
                elif not (36<=coords[0]<=39 and 125<=coords[1]<=128): record['reason']='국내 사업지 좌표 확인 필요'
                else:
                    record.update(latitude=coords[0],longitude=coords[1])
                    matched=[p for p in existing if p['latitude'] is not None and p['longitude'] is not None and identity(record,p)]
                    record['existing_candidates']=[dict(id=p['id'],name=p['name'],address=p['address'],distance_m=round(distance(record,p),1)) for p in matched]
                    move=re.search(r'(20\d{2})[.\-/](\d{2})',info.get('move_in_date',''))
                    month=f'{move[1]}.{move[2]}' if move and 1<=int(move[2])<=12 else ''
                    current=month>='2026.10' or info.get('supp_proc_step_nm') in ['분양중','분양 중','청약중','청약 중']
                    record['verified_move_in']=month
                    if len(matched)>1: record['reason']='같은 사업지에 기존 현장이 여러 개 있어 병합 확인 필요'
                    elif len(matched)==1:
                        p=matched[0];record['existing_id']=p['id'];record['existing_name']=p['name']
                        if compact(record['name'])==compact(p['name']): record.update(outcome='existing',reason='동일 사업지·이름의 기존 현장 확인')
                        elif current: record.update(outcome='rename',reason='동일 사업지·근접 좌표, 네이버의 현재 분양명으로 기존 현장 갱신')
                        else: record.update(outcome='existing',reason='동일 사업지의 기존 현장 확인; 현재 분양명 변경은 보류')
                    elif not current: record['reason']='현재 분양 중 또는 향후 입주 근거 추가 확인 필요'
                    else:
                        conflicts=[p for p in existing if p['latitude'] is not None and p['longitude'] is not None and distance(record,p)<=100 and (not parcels(address) or not parcels(p['address']) or parcels(address)&parcels(p['address']))]
                        if conflicts: record['reason']='인접 현장과 사업지 중복 가능성 확인 필요'
                        else: record.update(outcome='insert',reason='네이버 상세의 현재 분양/향후 입주 및 사업지·목록 식별자 확인')
            state['rows'].append(record);save()
            print(f"{len(state['rows'])}/{state['total']} {record['name']}: {record['outcome']}",flush=True)
        state['done']=len(state['rows'])==state['total'];save()
    except Exception as e:
        state['error']=str(e);save();raise

if __name__=='__main__':run()
