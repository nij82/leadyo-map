"""Extract regional existence from the inspected MOLIT workbook; never mark sites."""
import hashlib
import json
from pathlib import Path
import openpyxl

BASE = Path(__file__).parent
source = BASE / 'molit-2026-08.xlsx'
book = openpyxl.load_workbook(source, data_only=True, read_only=True)
sheet = book['총괄★']
rows = list(sheet.values)
assert str(rows[11][132]).strip() == '26.8', 'Unexpected current-month column'
regions = []
for number, row in enumerate(rows, 1):
    if 15 <= number <= 32 and isinstance(row[132], (int, float)):
        regions.append({'region': str(row[0]).replace(' ', ''), 'as_of': '2026-08-31',
                        'has_unsold_in_region': row[132] > 0, 'source_row': number})
assert len(regions) == 16, 'Expected 16 source rows including combined Jeonnam-Gwangju'
result = {'source_url': 'https://stat.molit.go.kr/portal/cate/statMetaView.do?hRsId=32',
          'source_sheet': sheet.title, 'source_column': 'EC',
          'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'as_of': '2026-08-31', 'scope': 'regional_aggregate_not_site_evidence',
          'note': 'August source combines 전남광주; blank 광주/전남 rows are not interpreted as zero.',
          'regions': regions}
(BASE / 'national-aggregate-review.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps(regions, ensure_ascii=False))
