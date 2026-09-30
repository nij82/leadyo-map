"""One resumable Gyeonggi apartment comparison job; DB writes stay in admin API."""
import json
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
STATE = ROOT / 'comparison-progress.json'
URL = 'https://isale.land.naver.com/iSale/AjaxContent/'

def compact(value):
    return re.sub(r'[^가-힣a-z0-9]', '', value.lower())

def parcels(value):
    return set(re.findall(r'(?<!\d)(\d{1,4}-\d{1,4})(?!\d)', value))

def blocks(value):
    return set(re.findall(r'([A-Z]?\d+)\s*(?:블록|BL\b)', value.upper()))

def same_notice(row, notice):
    # Exact normalized names AND explicit address evidence. No substring aliases.
    address = notice.get('address', notice.get('address_at_announcement', ''))
    name = notice.get('name', notice.get('name_at_announcement', ''))
    if compact(row['name']) != compact(name):
        return False
    if not address.startswith('경기도 '):
        return False
    if blocks(address) and blocks(row['address']) and blocks(address) != blocks(row['address']):
        return False
    locality = re.findall(r'[가-힣]+(?:시|군|구|동|읍|면)\b', address)
    if not locality or any(token not in row['address'] for token in locality):
        return False
    return bool(parcels(address) & parcels(row['address'])) or compact(address) == compact(row['address'])

def verified_listing(item, info, address):
    return (str(item['build_dtl_cd']) == str(info['build_dtl_cd']) and
            str(item['supp_cd']) == str(info['supp_cd']) and
            compact(item['name']) == compact(info['build_nm']) and
            all(part in address for part in item['region']) and
            36 <= float(item['ypos']) <= 39 and 125 <= float(item['xpos']) <= 128)

def classify(info, address, as_of):
    if info.get('bclass_nm') != '아파트' or '임대' in info.get('supp_sclass', ''):
        return None, '아파트 분양 비교 범위 밖'
    if not address.startswith('경기도 '):
        return None, '사업지 주소 확인 필요'
    move = re.search(r'(20\d{2})[.\-/](\d{2})', info.get('move_in_date', ''))
    if not move or not 1 <= int(move[2]) <= 12:
        return None, '입주예정월 확인 필요'
    month = f'{move[1]}.{move[2]}'
    if month.replace('.', '-') < as_of[:7]:
        return None, '입주예정월 경과: 현재 분양 여부 별도 확인 필요'
    if info.get('supp_proc_step_nm') not in ('입주예정', '분양중', '분양 중', '청약중', '청약 중'):
        return None, '현재 공급 단계 확인 필요'
    return month, None

def initial():
    return dict(version=1, scope='경기도 아파트', active=True, as_of=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat(),
                cities=None, city_index=0, towns=None, town_index=0, queue=[], seen=[],
                rows=[], held=[], excluded=[], list_receipts=[], collected=0, done=False, error=None)

def read():
    state = json.loads(STATE.read_text()) if STATE.exists() else initial()
    state.setdefault('excluded', [])
    for row in state['held']:
        if row['reason'] == '아파트 분양 비교 범위 밖' and row not in state['excluded']:
            state['excluded'].append(row)
    state['held'] = [r for r in state['held'] if r['reason'] != '아파트 분양 비교 범위 밖']
    return state

def save(state):
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(STATE)

def run():
    state = read()
    if state['done']:
        print(json.dumps({'done': True})); return
    session = requests.Session()
    calls = 0
    def post(params):
        nonlocal calls
        if calls: time.sleep(2)
        response = session.post(URL, data=params, timeout=25)
        calls += 1
        response.raise_for_status()  # Stop on access limits; never bypass/retry them.
        return ET.fromstring(response.text)
    def regions(city, level):
        xml = post(dict(sy_ajax_content='SYAreaChoiceList', sy_sido='경기도', sy_gugun=city,
                        sy_dong='', sy_ypos='37.6246096', sy_xpos='126.7056956', sy_dong_check=''))
        soup = BeautifulSoup(xml.findtext('SYViewContent') or '', 'html.parser')
        result = [n.parent.get_text(' ', strip=True) for n in soup.select(f'input[sy-data="{level}"]')]
        if not result: raise ValueError('지역 목록 형식 확인 필요')
        return result
    notices = json.loads((ROOT.parent / 'applyhome/applyhome_active_candidates_2026-09-30.json').read_text())
    if isinstance(notices, dict):
        notices = notices.get('candidates', notices.get('rows', []))
    try:
        state['error'] = None
        if state['cities'] is None:
            state['cities'] = regions('', 'gugun')
            if '김포시' in state['cities']:
                state['cities'].remove('김포시'); state['cities'].insert(0, '김포시')
            save(state)
        metadata_calls = 0
        details = 0
        while details < 20:
            if not state['queue']:
                if state['city_index'] >= len(state['cities']):
                    state['done'] = True; break
                if metadata_calls >= 5: break
                city = state['cities'][state['city_index']]
                if state['towns'] is None:
                    state['towns'] = regions(city, 'dong'); metadata_calls += 1; save(state)
                    continue
                if state['town_index'] >= len(state['towns']):
                    state['city_index'] += 1; state['towns'] = None; state['town_index'] = 0; save(state)
                    continue
                town = state['towns'][state['town_index']]
                params = dict(sy_ajax_content='SYAreaComplexList', sy_sido='경기도', sy_gugun=city,
                              sy_dong=town, bclass='IA01', sy_sort='0')
                xml = post(params); metadata_calls += 1
                names = [n.get_text(strip=True) for n in BeautifulSoup(xml.findtext('SYViewContent') or '', 'html.parser').select('.ComplexTitle')]
                data = json.loads(xml.findtext('SYComplexData'))['Data']
                if len(names) != len(data): raise ValueError('현장 목록과 식별자 개수 불일치')
                for name, item in zip(names, data):
                    key = f"{item['build_dtl_cd']}:{item['supp_cd']}"
                    if key not in state['seen']:
                        state['queue'].append(dict(name=name, region=[city, town], **item)); state['seen'].append(key)
                state['list_receipts'].append(dict(region=[city, town], returned_count=len(data), params=params))
                state['town_index'] += 1; save(state)
                continue
            item = state['queue'][0]
            xml = post(dict(sy_ajax_content='SYComplexInfo', build_dtl_cd=item['build_dtl_cd'], supp_cd=item['supp_cd']))
            info = json.loads(xml.findtext('SYJson'))
            if str(info['build_dtl_cd']) != str(item['build_dtl_cd']) or str(info['supp_cd']) != str(item['supp_cd']):
                raise ValueError('상세 현장 식별자 불일치')
            text = BeautifulSoup(xml.findtext('SYComplexContent') or '', 'html.parser').get_text(' ', strip=True)
            match = re.search(r'(?:분양주소|공급위치)\s+(.+?)\s+단지규모', text)
            address = match[1] if match else ''
            month, reason = classify(info, address, state['as_of'])
            if not (36 <= float(item['ypos']) <= 39 and 125 <= float(item['xpos']) <= 128):
                reason = '경기도 좌표 범위 확인 필요'
            name = info['build_nm']
            source_url = f"https://isale.land.naver.com/iSale/Map/#SYDetail?build_dtl_cd={item['build_dtl_cd']}&supp_cd={item['supp_cd']}"
            if reason:
                target = 'excluded' if reason == '아파트 분양 비교 범위 밖' else 'held'
                state[target].append(dict(name=name, reason=reason, source_url=source_url))
            else:
                row = dict(name=name, address=address, latitude=float(item['ypos']), longitude=float(item['xpos']), published=True,
                           product_details=dict(apartment=dict(units='', types='', price='', move_in=month, deposit='', interim='')))
                evidence = [n for n in notices if same_notice(row, n)]
                urls = sorted({n.get('official_notice_url', '') for n in evidence} - {''})
                naver_verified = verified_listing(item, info, address)
                row['review_source'] = dict(verified=naver_verified, source_url=source_url,
                    verification_basis=['네이버 목록·상세 식별자, 동일명, 사업지, 좌표 범위, 입주예정월 대조'] + (['청약홈 동일명·사업지 추가 대조'] if evidence and urls else []),
                    source_ids=dict(build_dtl_cd=item['build_dtl_cd'], supp_cd=item['supp_cd']),
                    official_notice_urls=urls,
                    naver_status=info.get('supp_proc_step_nm'), collected_at=datetime.now().astimezone().isoformat(),
                    reason=None if naver_verified else '네이버 목록·상세의 현장명 또는 지역 일치 확인 필요')
                state['rows'].append(row)
            state['queue'].pop(0); state['collected'] += 1; details += 1; save(state)
        save(state)
        print(json.dumps({'done': state['done'], 'collected': state['collected']}))
    except Exception as error:
        state['error'] = str(error); save(state)
        raise

if __name__ == '__main__':
    run()
