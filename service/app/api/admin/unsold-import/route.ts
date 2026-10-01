import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { identity } from "@/lib/supabase/server";

const rowSchema = z.object({
  project_id: z.uuid(),
  name: z.string().min(1),
  address: z.string().min(1),
  unsold_evidence: z
    .object({
      status: z.literal("confirmed"),
      as_of: z.literal("2026-08-31"),
      region: z.literal("경기도"),
      provider: z.literal("경기도청 주택정책과"),
      source_url: z.literal(
        "https://www.gg.go.kr/bbs/boardView.do?bsIdx=551&bIdx=266126616&menuId=1799",
      ),
      source_address: z.string().min(1),
      source_file_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .passthrough(),
});

async function reviewedRows(national = false) {
  if (national) {
    const filename = path.join(
      process.cwd(),
      "..",
      "research",
      "unsold",
      "national-2026-10-01",
      "approved-import.json",
    );
    const contents = await readFile(filename, "utf8");
    if (
      createHash("sha256").update(contents).digest("hex") !==
      "0e1cdcaa7ebae5b3e2624c44d5a047bf80e1492de7c8943cf84405a615a5a0f1"
    )
      throw new Error("검토한 전국 미분양 자료와 파일이 다릅니다.");
    const schema = rowSchema.extend({
      unsold_evidence: z
        .object({
          status: z.literal("confirmed"),
          as_of: z.string().regex(/^2026-(05|07|08)-31$/),
          region: z.string().min(1),
          provider: z.string().min(1),
          source_url: z.url(),
          source_address: z.string().min(1),
          source_file_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .passthrough(),
    });
    const rows = z.array(schema).length(27).parse(JSON.parse(contents));
    if (new Set(rows.map((row) => row.project_id)).size !== rows.length)
      throw new Error("검토 자료에 중복 현장이 있습니다.");
    return rows;
  }
  const filename = path.join(
    process.cwd(),
    "..",
    "research",
    "unsold",
    "gyeonggi_unsold_verified_2026-08.json",
  );
  const rows = z
    .array(rowSchema)
    .length(17)
    .parse(JSON.parse(await readFile(filename, "utf8")));
  if (new Set(rows.map((row) => row.project_id)).size !== rows.length)
    throw new Error("Duplicate reviewed projects");
  return rows;
}

async function adminClient() {
  if (process.env.NODE_ENV !== "development") return null;
  const { client, admin } = await identity();
  return admin ? client : null;
}

export async function GET(request: Request) {
  const client = await adminClient();
  if (!client)
    return Response.json(
      { error: "로그인한 관리자 권한이 필요합니다." },
      { status: 403 },
    );
  try {
    const national =
      new URL(request.url).searchParams.get("dataset") === "national";
    const rows = await reviewedRows(national);
    const { data, error } = await client
      .from("projects")
      .select("id,name,address,unsold_evidence")
      .in(
        "id",
        rows.map((row) => row.project_id),
      );
    if (error) throw new Error("반영 상태 조회 실패");
    const applied = rows.filter((row) => {
      const current = data?.find((project) => project.id === row.project_id);
      const previous = current?.unsold_evidence;
      return (
        current?.name === row.name &&
        current.address === row.address &&
        previous &&
        (previous.as_of > row.unsold_evidence.as_of ||
          (previous.as_of === row.unsold_evidence.as_of &&
            previous.source_file_sha256 ===
              row.unsold_evidence.source_file_sha256))
      );
    }).length;
    return Response.json({
      total: rows.length,
      applied,
      as_of: national ? null : "2026-08-31",
      projects: rows.map((row) => row.name),
    });
  } catch {
    return Response.json(
      { error: "검토된 미분양 자료를 확인하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!host || (origin !== `http://${host}` && origin !== `https://${host}`))
    return Response.json(
      { error: "요청 출처를 확인해 주세요." },
      { status: 403 },
    );
  const client = await adminClient();
  if (!client)
    return Response.json(
      { error: "로그인한 관리자 권한이 필요합니다." },
      { status: 403 },
    );
  let updated = 0,
    skipped = 0;
  try {
    const rows = await reviewedRows(
      new URL(request.url).searchParams.get("dataset") === "national",
    );
    for (const row of rows) {
      const { data: current, error: lookupError } = await client
        .from("projects")
        .select("id,name,address,unsold_evidence")
        .eq("id", row.project_id)
        .eq("published", true)
        .single();
      if (
        lookupError ||
        current.name !== row.name ||
        current.address !== row.address
      )
        throw new Error("현장명 또는 주소가 검토 후 변경됐습니다.");
      const previous = current.unsold_evidence;
      if (
        previous &&
        (previous.as_of > row.unsold_evidence.as_of ||
          (previous.as_of === row.unsold_evidence.as_of &&
            previous.source_file_sha256 ===
              row.unsold_evidence.source_file_sha256))
      ) {
        skipped += 1;
        continue;
      }
      const { data: changed, error } = await client
        .from("projects")
        .update({ unsold_evidence: row.unsold_evidence })
        .eq("id", row.project_id)
        .eq("name", row.name)
        .eq("address", row.address)
        .select("id")
        .single();
      if (error || !changed)
        throw new Error("현장 수정 권한 또는 저장 결과를 확인하지 못했습니다.");
      updated += 1;
    }
    revalidatePath("/");
    revalidatePath("/admin");
    return Response.json({ updated, skipped, total: rows.length });
  } catch (error) {
    revalidatePath("/");
    return Response.json(
      {
        error: error instanceof Error ? error.message : "반영에 실패했습니다.",
        updated,
        skipped,
      },
      { status: 500 },
    );
  }
}
