"""Build small, exact-match SQL batches for the reviewed ApplyHome details.

The script only prints SQL. It does not connect to or update the database.
"""

import argparse
import json
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
STAMP = date.today().isoformat()
SOURCE = HERE / f"project_details_review_{STAMP}.json"
PAYLOAD = HERE / f"project_applyhome_payload_{STAMP}.json"
BATCH_SIZE = 20


def import_row(project):
    notices = project["source_notices"]
    primary = next((notice for notice in notices
                    if notice["category"] in ("APT 일반 분양공고", "오피스텔 분양공고")),
                   notices[0])
    prices = [model["maximum_supply_price_10k_krw"] for model in primary["models"]
              if model["maximum_supply_price_10k_krw"] is not None]
    summary = {
        "product_type": project["product_type"],
        "category": primary["category"],
        "announced_at": primary["announced_at"],
        "notice_supply_units": primary["notice_supply_units"],
        "type_count": len(primary["models"]),
        "price_min_10k_krw": min(prices) if prices else None,
        "price_max_10k_krw": max(prices) if prices else None,
        "planned_move_in_month": primary["planned_move_in_month"],
        "builder": primary["builder"],
        "business_entity": primary["business_entity"],
    }
    details = {
        "collected_at": STAMP,
        "product_type": project["product_type"],
        "source_notices": notices,
        "nearby_planned_move_in": project["nearby_planned_move_in"],
    }
    return {"name": project["name"], "address": project["address"],
            "summary": summary, "details": details}


def sql_batch(rows):
    payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).replace("'", "''")
    return f"""do $applyhome_import$
declare updated_count integer;
begin
  with source as (
    select * from jsonb_to_recordset('{payload}'::jsonb)
      as item(name text, address text, summary jsonb, details jsonb)
  )
  update public.projects as project
  set applyhome_summary = source.summary,
      applyhome_details = source.details
  from source
  where project.name = source.name and project.address = source.address;
  get diagnostics updated_count = row_count;
  if updated_count <> {len(rows)} then
    raise exception 'Expected {len(rows)} project updates; found %', updated_count;
  end if;
end
$applyhome_import$;"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int)
    parser.add_argument("--write-payload", action="store_true")
    args = parser.parse_args()
    projects = json.loads(SOURCE.read_text(encoding="utf-8"))
    rows = [import_row(project) for project in projects]
    if len({(row["name"], row["address"]) for row in rows}) != len(rows):
        raise SystemExit("Duplicate name and address in review data")
    batches = [rows[index:index + BATCH_SIZE]
               for index in range(0, len(rows), BATCH_SIZE)]
    if args.write_payload:
        PAYLOAD.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n",
                           encoding="utf-8")
        print(json.dumps({"projects": len(rows), "output": str(PAYLOAD),
                          "database_writes": 0}))
    elif args.batch is None:
        print(json.dumps({"projects": len(rows), "batches": len(batches),
                          "batch_size": BATCH_SIZE, "database_writes": 0}))
    elif 0 <= args.batch < len(batches):
        print(sql_batch(batches[args.batch]))
    else:
        raise SystemExit("Batch index outside prepared range")


if __name__ == "__main__":
    main()
