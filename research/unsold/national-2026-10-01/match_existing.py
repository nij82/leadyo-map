"""Read-only conservative identity review. No database writes or fuzzy auto-matches."""
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

BASE = Path(__file__).parent
REGIONS = {'서울':'서울특별시','부산':'부산광역시','대구':'대구광역시','인천':'인천광역시',
           '광주':'광주광역시','대전':'대전광역시','울산':'울산광역시','세종':'세종특별자치시',
           '강원':'강원특별자치도','충북':'충청북도','충남':'충청남도','전북':'전북특별자치도',
           '전남':'전라남도','경북':'경상북도','경남':'경상남도','제주':'제주특별자치도'}

def norm(value):
    return re.sub(r'[^가-힣a-z0-9]', '', str(value or '').lower())

def localities(address):
    return set(re.findall(r'[가-힣]+(?:시|군|구|동|읍|면|리)', address or ''))

def parcels(address):
    return {(locality, re.sub(r'\s','',parcel)) for locality,parcel in
            re.findall(r'([가-힣0-9]+(?:동|리|가))\s*((?:산\s*)?\d+(?:-\d+)?)(?![\d-])', address or '')}

def roads(address):
    return {(road, number) for road,number in
            re.findall(r'([가-힣0-9]+(?:로|길))\s*(\d+(?:-\d+)?)(?![\d-])', address or '')}

def project_region(project):
    for short,full in REGIONS.items():
        if project['address'].startswith((full,short+'도 ',short+' ')):
            return short
    return None

def classify(source, projects):
    region = next((k for k,v in REGIONS.items() if source['region'] in (k,v)), source['region'])
    pool = [p for p in projects if project_region(p)==region]
    if source.get('warning') and '업데이트' in str(source['warning']):
        return 'held', 'source_updates_stopped', []
    if source.get('housing_type') in ('도시형생활주택','오피스텔') or any(x in (source.get('name') or '') for x in ('도시형생활주택','오피스텔')):
        return 'held', 'not_verified_apartment_type', []
    source_address = source.get('address') or ''
    candidates = []
    reasons = {}
    for p in pool:
        same_parcel = bool(parcels(source_address) & parcels(p['address']))
        same_road = bool(roads(source_address) & roads(p['address']))
        same_name = bool(source.get('name')) and norm(source['name'])==norm(p['name'])
        # The same parcel string must also have matching higher-level locality.
        high_source = set(re.findall(r'[가-힣]+(?:시|군|구|읍|면)',source_address.split(' ',1)[-1]))
        high_target = set(re.findall(r'[가-힣]+(?:시|군|구|읍|면)',p['address'].split(' ',1)[-1]))
        same_area = bool(high_source & high_target)
        strong_address = (same_parcel or same_road) and same_area
        address_conflict = bool(parcels(source_address) and parcels(p['address']) and not same_parcel)
        if strong_address or (same_name and not address_conflict and (not source_address or same_area)):
            candidates.append(p)
            reasons[p['id']] = 'unique_locality_parcel' if same_parcel and strong_address else 'unique_road_address' if same_road and strong_address else 'unique_name_region_area'
    # A block-specific project must not inherit evidence for an entire estate.
    if len(candidates)==1:
        p=candidates[0]
        if p.get('product_details') and 'apartment' not in p['product_details']:
            return 'held','existing_project_not_apartment',[p]
        building=re.findall(r'(?<!\d)\d{2,4}동',p['name'])
        if any(b not in ((source.get('name') or '')+source_address) for b in building):
            return 'held','building_specific_project',[p]
        return 'matched',reasons[p['id']],candidates
    return 'held', 'no_unique_identity_match' if not candidates else 'multiple_identity_matches', candidates

def main():
    projects=json.loads((BASE/'existing-with-products-2026-10-01.json').read_text())
    sources=[]
    for group in ('metro','central','south'):
        filenames=[BASE/group/'confirmed-sites.json']
        if group=='metro': filenames.append(BASE/group/'confirmed-addresses.json')
        assert all(f.exists() for f in filenames), f'Missing regional research: {group}'
        for row in [r for f in filenames for r in json.loads(f.read_text())]:
            row={**row,'research_group':group}
            if group=='metro':
                raw=row['address']
                parts=[REGIONS[row['region']]]
                if row.get('district'): parts.append(row['district'])
                if row.get('dong') and row['dong'] not in raw: parts.append(row['dong'])
                if not raw.startswith(REGIONS[row['region']]):
                    row['source_address_raw']=raw
                    row['address']=' '.join(parts+[raw])
            local=BASE/group/row['local_file']
            if local.exists(): row['source_file_sha256']=hashlib.sha256(local.read_bytes()).hexdigest()
            sources.append(row)
    matched,held=[],[]
    for source in sources:
        state,reason,candidates=classify(source,projects)
        record={**source,'match_method':reason,'candidate_ids':[p['id'] for p in candidates]}
        if state=='matched':
            p=candidates[0]
            record.update({'project_id':p['id'],'project_name':p['name'],'project_address':p['address']})
            matched.append(record)
        else: held.append(record)
    counts=Counter(r['project_id'] for r in matched)
    # Retain multiple official observations as evidence, not multiple sites.
    report={'review_date':'2026-10-01','existing_projects':len(projects),'source_records':len(sources),
            'matched_source_records':len(matched),'matched_unique_projects':len(counts),
            'held_source_records':len(held),'database_writes':0,
            'source_region_counts':dict(Counter(r['region'] for r in sources)),
            'held_reasons':dict(Counter(r['match_method'] for r in held))}
    for name,data in [('matched-existing',matched),('held-identity-review',held),('matching-summary',report)]:
        (BASE/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
