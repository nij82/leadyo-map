import { readFile, writeFile, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { identity } from "@/lib/supabase/server";

export const runtime = "nodejs";
const execute = promisify(execFile);
const root = path.join(process.cwd(), "..", "research", "naver");
const receiptPath = path.join(root, "hold-review-registration-2026-10-01.json");
const rowSchema = z.object({
  name: z.string().min(1),
  old_name: z.string().min(1),
  address: z.string(),
  outcome: z.enum(["insert", "rename", "existing", "excluded", "held"]),
  reason: z.string().nullable(),
  source_url: z
    .string()
    .startsWith("https://isale.land.naver.com/iSale/Map/#SYDetail?"),
  latitude: z.number().min(36).max(39).optional(),
  longitude: z.number().min(125).max(128).optional(),
  verified_move_in: z
    .string()
    .regex(/^$|^20\d{2}\.(0[1-9]|1[0-2])$/)
    .optional(),
  existing_id: z.string().uuid().optional(),
  existing_name: z.string().optional(),
});
async function scan() {
  const value = JSON.parse(
    await readFile(path.join(root, "hold-review-2026-10-01.json"), "utf8"),
  );
  let corrections: unknown[] = [];
  try {
    corrections = JSON.parse(
      await readFile(
        path.join(root, "hold-review-corrections-2026-10-01.json"),
        "utf8",
      ),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return {
    ...value,
    rows: z.array(rowSchema).parse([...value.rows, ...corrections]),
  } as {
    rows: z.infer<typeof rowSchema>[];
    total: number;
    done?: boolean;
    error: string | null;
  };
}
type Receipt = {
  nextIndex: number;
  inserted: number;
  renamed: number;
  skipped: number;
  resolved: { name: string; old_name: string; outcome: string; id?: string }[];
  held: { name: string; reason: string }[];
  error: string | null;
};
async function receipt(): Promise<Receipt> {
  try {
    return JSON.parse(await readFile(receiptPath, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return {
    nextIndex: 0,
    inserted: 0,
    renamed: 0,
    skipped: 0,
    resolved: [],
    held: [],
    error: null,
  };
}
async function save(value: Receipt) {
  await writeFile(receiptPath + ".tmp", JSON.stringify(value, null, 2));
  await rename(receiptPath + ".tmp", receiptPath);
}
async function client() {
  if (process.env.NODE_ENV !== "development") return null;
  const result = await identity();
  return result.admin ? result.client : null;
}
async function status(s: Awaited<ReturnType<typeof scan>>, r: Receipt) {
  const originalScan = JSON.parse(
    await readFile(path.join(root, "comparison-progress.json"), "utf8"),
  );
  const originalRegistration = JSON.parse(
    await readFile(
      path.join(root, "comparison-registration-progress.json"),
      "utf8",
    ),
  );
  const resolved = new Set(r.resolved.map((x) => x.old_name));
  const reasons = new Map([
    ...s.rows
      .filter((x) => x.outcome === "held")
      .map((x) => [x.old_name, x.reason] as const),
    ...r.held.map((x) => [x.name, x.reason] as const),
  ]);
  const held = [...originalScan.held, ...originalRegistration.held]
    .filter((x) => !resolved.has(x.name))
    .map((x) => ({ ...x, reason: reasons.get(x.name) || x.reason }));
  const done = Boolean(s.done && r.nextIndex === s.rows.length);
  return {
    ...r,
    total: s.total,
    collected: new Set(s.rows.map((x) => x.old_name)).size,
    registered: r.inserted,
    region: "보류 현장 재검토",
    held,
    done,
    resume: !done && !s.error && !r.error,
    error: s.error || r.error,
    excluded: r.resolved.filter((x) => x.outcome === "excluded").length,
  };
}
export async function GET() {
  if (!(await client()))
    return Response.json({ error: "운영 권한이 필요합니다." }, { status: 403 });
  try {
    return Response.json(await status(await scan(), await receipt()));
  } catch {
    return Response.json({ error: "검토 상태 확인 실패" }, { status: 500 });
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
  const db = await client();
  if (!db)
    return Response.json({ error: "운영 권한이 필요합니다." }, { status: 403 });
  if (applying)
    return Response.json({ error: "검토 작업 진행 중" }, { status: 409 });
  applying = true;
  let r: Receipt | undefined;
  try {
    r = await receipt();
    let s = await scan();
    if (r.nextIndex === s.rows.length && !s.done) {
      await execute("python3", [path.join(root, "review_naver_holds.py")], {
        timeout: 180_000,
        maxBuffer: 1024 * 1024,
      });
      s = await scan();
    }
    r.error = null;
    const end = Math.min(r.nextIndex + 20, s.rows.length);
    for (let i = r.nextIndex; i < end;) {
      const row = s.rows[i];
      let resolved = false;
      if (row.outcome === "held") {
        r.held.push({
          name: row.old_name,
          reason: row.reason || "추가 확인 필요",
        });
      } else if (row.outcome === "excluded") {
        resolved = true;
      } else if (row.outcome === "existing" || row.outcome === "rename") {
        if (!row.existing_id || !row.existing_name)
          throw new Error("기존 현장 식별자 누락");
        const { data: p, error } = await db
          .from("projects")
          .select("id,name,address,published")
          .eq("id", row.existing_id)
          .single();
        if (error || !p) throw new Error("기존 현장 조회 실패");
        const expected = JSON.parse(
          await readFile(path.join(root, "hold-review-existing.json"), "utf8"),
        ).find((x: { id: string }) => x.id === p.id);
        const targetName =
          row.name === "한양아이클래스양주" ? "한양아이클래스 양주" : row.name;
        if (
          !expected ||
          p.address !== expected.address ||
          !p.published ||
          ![row.existing_name, targetName].includes(p.name)
        ) {
          r.held.push({
            name: row.old_name,
            reason: "검토 이후 기존 현장 정보 또는 공개 상태가 변경됨",
          });
        } else {
          if (row.outcome === "rename" && p.name !== targetName) {
            const { data: changed, error: updateError } = await db
              .from("projects")
              .update({ name: targetName })
              .eq("id", p.id)
              .eq("name", p.name)
              .eq("address", p.address)
              .select("id");
            if (updateError || changed?.length !== 1)
              throw new Error("현재 현장명 저장 실패");
            r.renamed++;
          } else r.skipped++;
          resolved = true;
        }
      } else {
        if (
          !row.address.startsWith("경기도 ") ||
          row.latitude === undefined ||
          row.longitude === undefined
        )
          throw new Error("검증된 사업지·좌표 누락");
        const { data: nearby, error: lookupError } = await db
          .from("projects")
          .select("id,name,address,published")
          .gte("latitude", row.latitude - 0.002)
          .lte("latitude", row.latitude + 0.002)
          .gte("longitude", row.longitude - 0.003)
          .lte("longitude", row.longitude + 0.003);
        if (lookupError) throw new Error("등록 직전 중복 조회 실패");
        const compact = (x: string) =>
          x
            .normalize("NFKC")
            .replace(/[^가-힣a-z0-9]/gi, "")
            .toLowerCase();
        if (
          nearby?.some(
            (x) =>
              x.published &&
              compact(x.name) === compact(row.name) &&
              compact(x.address) === compact(row.address),
          )
        ) {
          r.skipped++;
          resolved = true;
        } else {
          const { data: inserted, error: insertError } = await db
            .from("projects")
            .insert({
              name: row.name,
              address: row.address,
              latitude: row.latitude,
              longitude: row.longitude,
              published: true,
              product_details: {
                apartment: {
                  units: "",
                  types: "",
                  price: "",
                  move_in: row.verified_move_in || "",
                  deposit: "",
                  interim: "",
                },
              },
            })
            .select("id")
            .single();
          if (insertError?.code === "23505")
            r.held.push({
              name: row.old_name,
              reason: "동시 등록 또는 좌표 중복 확인 필요",
            });
          else if (insertError || !inserted)
            throw new Error("신규 현장 저장 실패");
          else {
            r.inserted++;
            resolved = true;
            row.existing_id = inserted.id;
          }
        }
      }
      if (resolved)
        r.resolved.push({
          name: row.name,
          old_name: row.old_name,
          outcome: row.outcome,
          id: row.existing_id,
        });
      r.nextIndex = ++i;
      await save(r);
    }
    revalidatePath("/");
    revalidatePath("/admin");
    return Response.json(await status(s, r));
  } catch (error) {
    const message = error instanceof Error ? error.message : "검토 저장 실패";
    if (r) {
      r.error = message;
      await save(r);
    }
    return Response.json({ error: message }, { status: 500 });
  } finally {
    applying = false;
  }
}
