"""Classify Gyeonggi's official monthly XLSX against existing projects.

Read-only collection. Never publishes projects or infers zero unsold inventory
from missing rows. Workbook contact details are not copied into outputs.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

import openpyxl

SOURCE_URL = 'https://www.gg.go.kr/bbs/boardView.do?bsIdx=551&bIdx=266126616&menuId=1799'
FILE_URL = 'https://www.gg.go.kr/uploads/BOARD/2026/09/20260930091022_Q8Q3omcKbgWlhG19fYF.xlsx'
AS_OF = '2026-08-31'


def compact(value):
    return re.sub(r'\s+|번지', '', str(value or ''))


def parcels(value):
    return {compact(v) for v in re.findall(r'(?<![\dA-Za-z])(?:산\s*)?\d+(?:-\d+)?(?![\dA-Za-z])', value)}


def localities(value):
    return set(re.findall(r'[가-힣]+(?:동|읍|면|리)', value))


def matches(group, project):
    source, target = group['address'], project['address']
    if not group['city'] or group['city'] not in target or 'apartment' not in project['product_types']:
        return False
    if not localities(source).intersection(localities(target)) or not parcels(source).intersection(parcels(target)):
        return False
    # A whole-complex observation cannot establish the status of a named building.
    buildings = re.findall(r'(?<!\d)\d{2,4}동', project['name'])
    if any(building not in source for building in buildings):
        return False
    return True


def extract(sheet):
    groups, group, city, sale_type = [], None, None, None
    for number, row in enumerate(sheet.iter_rows(min_row=7, max_col=18, values_only=True), 7):
        if row[1] and re.fullmatch(r'[가-힣]+(?:시|군)', str(row[1]).strip()):
            city = str(row[1]).strip()
        if row[10] is not None:
            sale_type = str(row[10]).strip()
        if row[3] and compact(row[3]) not in ('합계', '소계'):
            group = {'row': number, 'city': city, 'address': str(row[3]).strip(),
                     'sale_type': sale_type, 'positive_rows': []}
            groups.append(group)
        # Close a site at its subtotal. Prevent anonymous subsequent sites from
        # inheriting the previous visible address through blank/merged cells.
        if compact(row[6]) in ('계', '소계', '합계') or compact(row[11]) in ('계', '소계', '합계'):
            group = None
            continue
        if group is not None and row[11] is not None and isinstance(row[14], (int, float)) and row[14] > 0:
            group['positive_rows'].append(number)
        if row[1] and '총괄' in compact(row[1]):
            group = None
    return groups


def classify(groups, projects, sha256):
    verified, held = [], []
    for group in groups:
        if not group['positive_rows'] or group['sale_type'] != '분양':
            continue
        if any(word in group['address'] for word in ('비공개','미공개')):
            held.append({**group, 'reason': 'private_source_address'})
            continue
        candidates = [p for p in projects if matches(group, p)]
        if len(candidates) != 1:
            held.append({**group, 'reason': 'no_unique_exact_address_match',
                         'candidate_ids': [p['id'] for p in candidates]})
            continue
        project = candidates[0]
        verified.append({'project_id': project['id'], 'name': project['name'], 'address': project['address'],
                         'unsold_evidence': {'status': 'confirmed', 'as_of': AS_OF, 'region': '경기도',
                                             'provider': '경기도청 주택정책과', 'source_url': SOURCE_URL,
                                             'source_file_url': FILE_URL, 'source_file_sha256': sha256,
                                             'source_sheet': '업체별 현황 ', 'source_site_row': group['row'],
                                             'source_address': group['address'],
                                             'source_positive_rows': group['positive_rows'],
                                             'match_method': 'unique_city_locality_parcel',
                                             'collected_at': datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()}})
    duplicates = {v['project_id'] for v in verified if sum(r['project_id'] == v['project_id'] for r in verified)>1}
    if duplicates:
        held.extend({**v, 'reason': 'multiple_source_sites_for_project'} for v in verified if v['project_id'] in duplicates)
        verified = [v for v in verified if v['project_id'] not in duplicates]
    return verified, held


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--xlsx', type=Path, required=True)
    parser.add_argument('--projects', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    workbook = openpyxl.load_workbook(args.xlsx, data_only=True, read_only=True)
    sheet = workbook['업체별 현황 ']
    if "26.08.31" not in compact(sheet['A1'].value) or "26.08/31" not in compact(sheet['O4'].value):
        raise SystemExit('Source month or current-month column does not match expected 2026-08')
    groups = extract(sheet)
    workbook.close()
    sha256 = hashlib.sha256(args.xlsx.read_bytes()).hexdigest()
    projects = json.loads(args.projects.read_text())
    verified, held = classify(groups, projects, sha256)
    args.output.mkdir(parents=True, exist_ok=True)
    for name, rows in [('source_sites', groups), ('verified', verified), ('held', held)]:
        (args.output/f'gyeonggi_unsold_{name}_2026-08.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
    report = {'as_of':AS_OF, 'source_url':SOURCE_URL, 'source_file_url':FILE_URL, 'sha256':sha256,
              'existing_projects_reviewed':len(projects), 'visible_address_groups':len(groups),
              'positive_sale_groups':sum(bool(g['positive_rows']) and g['sale_type']=='분양' for g in groups),
              'verified_existing_projects':len(verified), 'held_groups':len(held), 'database_writes':0}
    (args.output/'gyeonggi_unsold_report_2026-08.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
