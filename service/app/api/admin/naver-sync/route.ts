import { readFile, writeFile, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
export const runtime = "nodejs";
const execute = promisify(execFile);
import { ImportReviewHold, runImportBatch } from "@/lib/import-batch";
import path from "node:path";
import { sameNaverSite } from "@/lib/naver-identity";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { identity } from "@/lib/supabase/server";

const schema = z.object({
  name: z.string().min(1),
  address: z.string().startsWith("경기도 "),
  latitude: z.number().min(36).max(39),
  longitude: z.number().min(125).max(128),
  published: z.literal(true),
  review_source: z.object({
    verified: z.boolean(),
    reason: z.string().nullable(),
  }),
  product_details: z.object({
    apartment: z.object({
      units: z.literal(""),
      types: z.literal(""),
      price: z.literal(""),
      move_in: z.string().regex(/^20\d{2}\.\d{2}$/),
      deposit: z.literal(""),
      interim: z.literal(""),
    }),
  }),
});
const researchPath = path.join(process.cwd(), "..", "research", "naver");
async function collection() {
  return JSON.parse(
    await readFile(path.join(researchPath, "comparison-progress.json"), "utf8"),
  ) as {
    active: boolean;
    scope: string;
    rows: unknown[];
    held: { name: string; reason: string }[];
    excluded?: { name: string; reason: string }[];
    collected: number;
    done: boolean;
    error: string | null;
    cities: string[] | null;
    city_index: number;
    towns: string[] | null;
    town_index: number;
  };
}
async function rows() {
  return z.array(schema).parse((await collection()).rows);
}
async function adminClient() {
  if (process.env.NODE_ENV !== "development") return null;
  const { client, admin } = await identity();
  return admin ? client : null;
}
function meters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
// Distinct blocks within the reviewed Pungmu station district may be adjacent.
function differentPungmuBlocks(address: string, otherAddress: string) {
  const block = /풍무역세권[^)]*?\b(B\d+)\s*(?:블록|BL)/i;
  const first = address.match(block)?.[1].toUpperCase();
  const second = otherAddress.match(block)?.[1].toUpperCase();
  return Boolean(first && second && first !== second);
}
type Progress = {
  fingerprint: string;
  nextIndex: number;
  inserted: number;
  skipped: number;
  held: { name: string; reason: string }[];
  done: boolean;
  error: string | null;
};
const receiptPath = path.join(
  process.cwd(),
  "..",
  "research",
  "naver",
  "comparison-registration-progress.json",
);
async function progress(
  projects: Awaited<ReturnType<typeof rows>>,
): Promise<Progress> {
  const fingerprint = "gyeonggi-apartment-comparison-v4";
  try {
    const saved = JSON.parse(await readFile(receiptPath, "utf8")) as Progress;
    if (
      saved.fingerprint === fingerprint &&
      Number.isInteger(saved.nextIndex) &&
      saved.nextIndex >= 0 &&
      saved.nextIndex <= projects.length
    )
      return saved;
  } catch {
    /* No saved progress for this reviewed payload. */
  }
  return {
    fingerprint,
    nextIndex: 0,
    inserted: 0,
    skipped: 0,
    held: [],
    done: false,
    error: null,
  };
}
async function saveProgress(value: Progress) {
  const temporary = receiptPath + ".tmp";
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, receiptPath);
}
export async function GET() {
  const client = await adminClient();
  if (!client)
    return Response.json({ error: "운영 권한이 필요합니다." }, { status: 403 });
  try {
    const scan = await collection();
    const projects = await rows();
    const saved = await progress(projects);
    return Response.json({
      ...saved,
      total: projects.length,
      collected: scan.collected,
      excluded: scan.excluded?.length || 0,
      scope: scan.scope,
      region: scan.cities?.[scan.city_index] || scan.scope,
      registered: saved.inserted,
      projects: [],
      held: [...scan.held, ...saved.held],
      done: scan.done && saved.nextIndex === projects.length,
      resume:
        scan.active &&
        !(scan.done && saved.nextIndex === projects.length) &&
        !scan.error &&
        !saved.error,
      error: scan.error || saved.error,
    });
  } catch {
    return Response.json(
      { error: "대조 작업 상태를 확인하지 못했습니다." },
      { status: 500 },
    );
  }
}
let applying = false;
export async function POST(request: Request) {
  const host = request.headers.get("host"),
    origin = request.headers.get("origin");
  if (!host || ![`http://${host}`, `https://${host}`].includes(origin || ""))
    return Response.json(
      { error: "요청 출처를 확인해 주세요." },
      { status: 403 },
    );
  const client = await adminClient();
  if (!client)
    return Response.json({ error: "운영 권한이 필요합니다." }, { status: 403 });
  if (applying)
    return Response.json(
      { error: "같은 등록 작업이 진행 중입니다." },
      { status: 409 },
    );
  applying = true;
  try {
    let projects = await rows();
    let saved = await progress(projects);
    let scan = await collection();
    if (!scan.active) {
      scan.active = true;
      const temp = path.join(researchPath, "comparison-progress.json.tmp");
      await writeFile(temp, JSON.stringify(scan, null, 2));
      await rename(temp, path.join(researchPath, "comparison-progress.json"));
    }
    if (saved.nextIndex === projects.length && !scan.done) {
      await execute("python3", [path.join(researchPath, "naver_pipeline.py")], {
        timeout: 180_000,
        maxBuffer: 1024 * 1024,
      });
      projects = await rows();
      saved = await progress(projects);
      scan = await collection();
    }
    if (scan.done && saved.nextIndex === projects.length)
      return Response.json({
        ...saved,
        done: true,
        total: projects.length,
        collected: scan.collected,
        excluded: scan.excluded?.length || 0,
        held: [...scan.held, ...saved.held],
      });
    const result = await runImportBatch(
      projects,
      saved.nextIndex,
      async (row) => {
        const { data: named, error: nameError } = await client
          .from("projects")
          .select("id,address,latitude,longitude,published")
          .eq("name", row.name);
        if (nameError)
          throw new Error("DB 조회 연결 또는 운영 권한을 확인해 주세요.");
        if (named?.length) {
          if (
            named.length !== 1 ||
            !named[0].published ||
            named[0].address !== row.address ||
            meters(
              row.latitude,
              row.longitude,
              named[0].latitude,
              named[0].longitude,
            ) > 200
          )
            throw new ImportReviewHold("같은 이름의 기존 현장 확인 필요");
          return "skipped";
        }
        const { data: nearby, error: nearbyError } = await client
          .from("projects")
          .select("id,name,address,latitude,longitude,published")
          .gte("latitude", row.latitude - 0.003)
          .lte("latitude", row.latitude + 0.003)
          .gte("longitude", row.longitude - 0.004)
          .lte("longitude", row.longitude + 0.004);
        if (nearbyError)
          throw new Error("DB 조회 연결 또는 운영 권한을 확인해 주세요.");
        if (!row.review_source.verified)
          throw new ImportReviewHold(
            row.review_source.reason || "사업지 근거 대조 필요",
          );
        if (
          nearby?.some(
            (p) =>
              p.published &&
              sameNaverSite(row, p) &&
              meters(row.latitude, row.longitude, p.latitude, p.longitude) <=
                200,
          )
        )
          return "skipped";
        if (
          nearby?.some(
            (p) =>
              meters(row.latitude, row.longitude, p.latitude, p.longitude) <=
                200 && !differentPungmuBlocks(row.address, p.address),
          )
        )
          throw new ImportReviewHold("200m 이내 기존 현장과 동일성 확인 필요");
        const payload = schema.omit({ review_source: true }).parse(row);
        const { error } = await client.from("projects").insert(payload);
        if (error) {
          if (error.code === "23505")
            throw new ImportReviewHold("동시 등록 또는 중복 현장 확인 필요");
          throw new Error(
            `${row.name}: 저장 연결 또는 운영 권한을 확인해 주세요.`,
          );
        }
        return "inserted";
      },
    );
    const updated: Progress = {
      ...saved,
      ...result,
      done: scan.done && result.nextIndex === projects.length,
      inserted: saved.inserted + result.inserted,
      skipped: saved.skipped + result.skipped,
      held: [...saved.held, ...result.held],
    };
    await saveProgress(updated);
    revalidatePath("/");
    revalidatePath("/admin");
    return Response.json(
      {
        ...updated,
        total: projects.length,
        collected: scan.collected,
        excluded: scan.excluded?.length || 0,
        region: scan.cities?.[scan.city_index] || scan.scope,
        held: [...scan.held, ...updated.held],
      },
      { status: result.error ? 500 : 200 },
    );
  } catch {
    return Response.json(
      {
        error:
          "진행 상태를 저장하지 못했습니다. 등록된 현장은 재개 시 건너뜁니다.",
      },
      { status: 500 },
    );
  } finally {
    applying = false;
  }
}
