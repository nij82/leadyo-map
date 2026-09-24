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
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(
    await readFile(
      "supabase/migrations/" +
        (await readdir("supabase/migrations")).find((f) => f.endsWith(".sql")),
      "utf8",
    ),
  );
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
