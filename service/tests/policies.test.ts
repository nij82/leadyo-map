import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333",
  project = "44444444-4444-4444-8444-444444444444",
  post = "55555555-5555-4555-8555-555555555555";
test("PostgreSQL RLS: public reads, ownership, moderation, suspension and audit", async () => {
  const db = new PGlite();
  const migrations = (await readdir("supabase/migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(await readFile("supabase/migrations/" + migrations[0], "utf8"));
  await db.exec(
    `insert into auth.users values('${alice}',now()),('${bob}',now()),('${admin}',now());`,
  );
  async function as(id: string | null, role = "authenticated") {
    await db.exec(
      `reset role;select set_config('request.jwt.claim.sub','${id || ""}',false);set role ${role};`,
    );
  }
  for (const id of [alice, bob, admin]) {
    await as(id);
    await db.query(
      "insert into public.profiles(id,name,organization,phone,legal_version) values($1,'테스트','모집팀','010-0000-0000','test')",
      [id],
    );
  }
  await as(null, "postgres");
  await db.exec(
    `update private.member_access set role='admin' where id='${admin}';`,
  );
  await as(admin);
  await db.exec(
    `insert into public.projects(id,name,address,latitude,longitude,published) values('${project}','테스트 아파트','테스트 주소',37,127,true);`,
  );
  await as(alice);
  await db.exec(
    `insert into public.listings(id,project_id,owner_id,organization,workplace,rates,payment,trigger_condition,clawback,phone,phone_consent) values('${post}','${project}','${alice}','모집팀','근무지','[{"role":"member","amount":650}]','익월','계약','환수','010-0000-0000',true);`,
  );
  await as(null, "postgres");
  for (const file of migrations.slice(1))
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  const legacy = await db.query<{
    product_type: string | null;
    rate_options: unknown;
    supports: unknown;
  }>(
    `select product_type, rate_options, supports from public.listings where id='${post}'`,
  );
  assert.equal(legacy.rows[0].product_type, null);
  assert.equal(legacy.rows[0].rate_options, null);
  assert.equal(legacy.rows[0].supports, null);
  await as(alice);
  await assert.rejects(
    db.exec(
      `insert into public.listings(project_id,owner_id,organization,workplace,rates,payment,trigger_condition,clawback,phone,phone_consent) values('${project}','${alice}','새 공고','근무지','[{"role":"member","amount":650}]','익월','계약','환수','010-0000-0000',true);`,
    ),
  );
  const supportStates = Object.fromEntries(
    ["ad", "db", "daily", "housing", "meal"].map((key) => [
      key,
      { status: "unknown", detail: "" },
    ]),
  );
  const created = await db.query<{ id: string }>(
    `insert into public.listings(project_id,owner_id,organization,workplace,rates,product_type,rate_options,supports,payment,trigger_condition,clawback,phone,phone_consent)
     values($1,$2,'새 공고','근무지',$3::jsonb,'officetel',$4::jsonb,$5::jsonb,'월 2회 지급','계약금 완납','해약 시 환수','010-0000-0000',true) returning id`,
    [
      project,
      alice,
      JSON.stringify([{ role: "team", amount: 480 }]),
      JSON.stringify([{ label: "", rates: [{ role: "team", amount: 480 }] }]),
      JSON.stringify(supportStates),
    ],
  );
  assert.equal(created.rows.length, 1);
  await as(null, "postgres");
  const duplicateBlankTypes = await db.query<{ valid: boolean }>(
    `select private.valid_rate_options($1::jsonb) as valid`,
    [
      JSON.stringify([
        { label: "", rates: [{ role: "team", amount: 480 }] },
        { label: "", rates: [{ role: "member", amount: 300 }] },
      ]),
    ],
  );
  assert.equal(duplicateBlankTypes.rows[0].valid, false);
  await db.query("delete from public.listings where id=$1", [
    created.rows[0].id,
  ]);
  const request = "66666666-6666-4666-8666-666666666666";
  await as(alice);
  await db.exec(
    `insert into public.site_requests(id,owner_id,name,address) values('${request}','${alice}','신규 현장','확인할 주소');`,
  );
  await as(bob);
  assert.equal(
    (
      await db.query(
        `update public.site_requests set status='resolved' where id='${request}' returning id`,
      )
    ).rows.length,
    0,
  );
  await as(admin);
  assert.equal(
    (
      await db.query(
        `update public.site_requests set status='resolved' where id='${request}' returning id`,
      )
    ).rows.length,
    1,
  );
  await as(null, "anon");
  assert.equal(
    (await db.query("select * from public.listings")).rows.length,
    1,
  );
  await assert.rejects(db.exec("select * from public.profiles"));
  await assert.rejects(
    db.exec(`select public.moderate_listing('${post}','hidden','불가')`),
  );
  await as(bob);
  assert.equal(
    (
      await db.query(
        `update public.listings set support='침범' where id='${post}' returning id`,
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    db.exec(`update private.member_access set role='admin' where id='${bob}'`),
  );
  await assert.rejects(
    db.exec(`select public.set_member_status('${alice}','suspended','불가')`),
  );
  await as(alice);
  await assert.rejects(
    db.exec(`update public.listings set owner_id='${bob}' where id='${post}'`),
  );
  await assert.rejects(
    db.exec(
      `update public.listings set moderation='hidden' where id='${post}'`,
    ),
  );
  await assert.rejects(
    db.exec(
      `update public.profiles set legal_version='changed' where id='${alice}'`,
    ),
  );
  await as(admin);
  await db.exec(`select public.moderate_listing('${post}','hidden','검증');`);
  await as(alice);
  await db.exec(`update public.listings set support='수정' where id='${post}'`);
  assert.equal(
    (
      await db.query<{ moderation: string }>(
        `select moderation from public.listings where id='${post}'`,
      )
    ).rows[0].moderation,
    "hidden",
  );
  await assert.rejects(
    db.exec(
      `update public.listings set moderation='visible' where id='${post}'`,
    ),
  );
  await as(null, "anon");
  assert.equal(
    (await db.query("select * from public.listings")).rows.length,
    0,
  );
  await as(admin);
  await db.exec(
    `select public.moderate_listing('${post}','visible','확인');select public.set_member_status('${alice}','suspended','정지');`,
  );
  await as(alice);
  assert.equal(
    (
      await db.query(
        `update public.listings set support='불가' where id='${post}' returning id`,
      )
    ).rows.length,
    0,
  );
  await as(admin);
  await assert.rejects(
    db.exec(`select public.moderate_listing('${post}','visible','불가')`),
  );
  await db.exec(`select public.set_member_status('${alice}','active','해제');`);
  assert.equal(
    (
      await db.query<{ moderation: string }>(
        `select moderation from public.listings where id='${post}'`,
      )
    ).rows[0].moderation,
    "hidden",
  );
  await db.exec(`select public.moderate_listing('${post}','deleted','삭제');`);
  await as(alice);
  assert.equal(
    (
      await db.query(
        `update public.listings set support='불가' where id='${post}' returning id`,
      )
    ).rows.length,
    0,
  );
  await as(admin);
  assert.ok(
    (await db.query("select * from public.audit_logs")).rows.length >= 6,
  );
  await db.close();
});
