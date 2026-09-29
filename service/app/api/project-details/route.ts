import { serverClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    return Response.json({ error: "현장 ID를 확인해 주세요." }, { status: 400 });
  const client = await serverClient();
  if (!client)
    return Response.json({ error: "현장 정보를 읽을 수 없습니다." }, { status: 503 });
  const { data, error } = await client
    .from("projects")
    .select("applyhome_details")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (error)
    return Response.json({ error: "현장 정보를 읽지 못했습니다." }, { status: 500 });
  if (!data)
    return Response.json({ error: "현장을 찾지 못했습니다." }, { status: 404 });
  return Response.json(data.applyhome_details, {
    headers: { "Cache-Control": "no-store" },
  });
}
