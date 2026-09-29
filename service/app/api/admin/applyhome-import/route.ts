import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { identity } from "@/lib/supabase/server";
import type { ApplyhomeDetails, ApplyhomeSummary } from "@/lib/types";

type ImportRow = {
  name: string;
  address: string;
  summary: ApplyhomeSummary;
  details: ApplyhomeDetails;
};
const BATCH_SIZE = 20;

async function importRows(): Promise<ImportRow[]> {
  const source = path.join(
    process.cwd(),
    "..",
    "research",
    "applyhome",
    "project_applyhome_payload_2026-09-29.json",
  );
  const rows = JSON.parse(await readFile(source, "utf8")) as ImportRow[];
  if (!Array.isArray(rows) || rows.length !== 544)
    throw new Error("ApplyHome import file is incomplete");
  return rows;
}

async function adminClient() {
  if (process.env.NODE_ENV !== "development") return null;
  const { client, admin } = await identity();
  return admin ? client : null;
}

export async function GET() {
  const client = await adminClient();
  if (!client) return Response.json({ error: "운영 권한이 필요합니다." }, { status: 403 });
  try {
    const rows = await importRows();
    const { count, error } = await client
      .from("projects")
      .select("id", { count: "exact", head: true })
      .not("applyhome_summary", "is", null);
    if (error) throw error;
    return Response.json({ total: rows.length, applied: count || 0, batches: Math.ceil(rows.length / BATCH_SIZE) });
  } catch {
    return Response.json({ error: "수집 자료를 찾지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host || (origin !== `http://${host}` && origin !== `https://${host}`))
    return Response.json({ error: "요청 출처를 확인해 주세요." }, { status: 403 });
  const client = await adminClient();
  if (!client) return Response.json({ error: "운영 권한이 필요합니다." }, { status: 403 });
  try {
    const { batch } = await request.json();
    const rows = await importRows();
    const batches = Math.ceil(rows.length / BATCH_SIZE);
    if (!Number.isInteger(batch) || batch < 0 || batch >= batches)
      return Response.json({ error: "적용 순서를 확인해 주세요." }, { status: 400 });
    const selected = rows.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE);
    for (const row of selected) {
      const { data, error } = await client
        .from("projects")
        .update({ applyhome_summary: row.summary, applyhome_details: row.details })
        .eq("name", row.name)
        .eq("address", row.address)
        .select("id");
      if (error || data?.length !== 1)
        return Response.json({ error: `${row.name} 현장을 갱신하지 못했습니다.` }, { status: 500 });
    }
    revalidatePath("/");
    return Response.json({ batch, updated: selected.length });
  } catch {
    return Response.json({ error: "수집 자료를 적용하지 못했습니다." }, { status: 500 });
  }
}
