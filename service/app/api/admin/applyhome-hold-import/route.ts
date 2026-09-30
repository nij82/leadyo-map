import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { identity } from "@/lib/supabase/server";
import type {
  ApplyhomeDetails,
  ApplyhomeSummary,
  ProductType,
  ProjectProductDetail,
} from "@/lib/types";

type ImportRow = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  published: true;
  product_details: Partial<Record<ProductType, ProjectProductDetail>>;
  applyhome_summary: ApplyhomeSummary;
  applyhome_details: ApplyhomeDetails;
};
const BATCH_SIZE = 10;

async function importRows(): Promise<ImportRow[]> {
  const source = path.join(
    process.cwd(),
    "..",
    "research",
    "applyhome",
    "project_hold_ready_payload_2026-09-30.json",
  );
  const rows = JSON.parse(await readFile(source, "utf8")) as ImportRow[];
  if (!Array.isArray(rows) || rows.length !== 192)
    throw new Error("Held-project import file is incomplete");
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
    return Response.json({ total: rows.length, batches: Math.ceil(rows.length / BATCH_SIZE) });
  } catch {
    return Response.json({ error: "검토된 현장 자료를 찾지 못했습니다." }, { status: 500 });
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
    let inserted = 0;
    let skipped = 0;
    for (const row of selected) {
      const { data: existing, error: lookupError } = await client
        .from("projects")
        .select("id")
        .eq("name", row.name)
        .eq("address", row.address)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        skipped += 1;
        continue;
      }
      // Keep research metadata (such as review_source) out of the DB payload.
      const project: ImportRow = {
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        published: row.published,
        product_details: row.product_details,
        applyhome_summary: row.applyhome_summary,
        applyhome_details: row.applyhome_details,
      };
      const { error } = await client.from("projects").insert(project);
      if (error) throw error;
      inserted += 1;
    }
    revalidatePath("/");
    revalidatePath("/admin");
    return Response.json({ batch, inserted, skipped });
  } catch {
    return Response.json({ error: "검토된 현장 등록을 완료하지 못했습니다." }, { status: 500 });
  }
}
