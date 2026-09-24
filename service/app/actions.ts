"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { identity, serverClient } from "@/lib/supabase/server";
import { listingSchema, profileSchema } from "@/lib/validation";
export type ActionState = { message: string; ok?: boolean };
const fail = (message: string): ActionState => ({ message });
export async function saveProfile(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, user, profile } = await identity();
  if (!client || !user) return fail("로그인 후 이용해 주세요.");
  if (
    !process.env.LEGAL_VERSION ||
    !process.env.NEXT_PUBLIC_TERMS_URL ||
    !process.env.NEXT_PUBLIC_PRIVACY_URL
  )
    return fail("가입 안내를 준비하고 있습니다.");
  const parsed = profileSchema.safeParse({
    ...Object.fromEntries(form),
    consent: form.get("consent") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { name, organization, phone } = parsed.data;
  const result = profile
    ? await client
        .from("profiles")
        .update({ name, organization, phone })
        .eq("id", user.id)
    : await client
        .from("profiles")
        .insert({
          id: user.id,
          name,
          organization,
          phone,
          legal_version: process.env.LEGAL_VERSION,
        });
  if (result.error)
    return fail("저장하지 못했습니다. 계정 상태를 확인해 주세요.");
  revalidatePath("/");
  return {
    message: "모집공고자 정보를 저장했습니다. 내 공고에서 등록할 수 있습니다.",
    ok: true,
  };
}
export async function logout() {
  const c = await serverClient();
  await c?.auth.signOut();
  redirect("/");
}
export async function saveListing(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, user, profile } = await identity();
  if (!client || !user || !profile)
    return fail("모집공고자 정보를 먼저 등록해 주세요.");
  let rates;
  try {
    rates = JSON.parse(String(form.get("rates")));
  } catch {
    return fail("모집 금액을 확인해 주세요.");
  }
  const parsed = listingSchema.safeParse({
    ...Object.fromEntries(form),
    rates,
    phone_consent: form.get("phone_consent") === "on",
  });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const id = String(form.get("id") || ""),
    value = { ...parsed.data, kakao_url: parsed.data.kakao_url || null };
  const result = id
    ? await client
        .from("listings")
        .update(value)
        .eq("id", id)
        .eq("owner_id", user.id)
        .select("id")
    : await client
        .from("listings")
        .insert({ ...value, owner_id: user.id })
        .select("id");
  if (result.error || !result.data?.length)
    return fail("저장하지 못했습니다. 계정이나 공고 상태를 확인해 주세요.");
  revalidatePath("/");
  revalidatePath("/manage");
  return {
    message:
      "공고를 저장했습니다. 운영자가 숨긴 공고는 비공개 상태가 유지됩니다.",
    ok: true,
  };
}
export async function setListingState(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, user } = await identity();
  const status = form.get("status");
  if (!client || !user || !["published", "closed"].includes(String(status)))
    return fail("요청을 처리할 수 없습니다.");
  const { data, error } = await client
    .from("listings")
    .update({ status })
    .eq("id", String(form.get("id")))
    .eq("owner_id", user.id)
    .eq("moderation", "visible")
    .select("id");
  if (error || !data?.length) return fail("변경할 수 없는 공고입니다.");
  revalidatePath("/");
  return { message: "공고 상태를 변경했습니다.", ok: true };
}
export async function requestSite(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, user, profile } = await identity();
  if (!client || !user || !profile)
    return fail("모집공고자 가입 후 요청할 수 있습니다.");
  const name = String(form.get("name") || "").trim(),
    address = String(form.get("address") || "").trim();
  if (!name || name.length > 150 || !address || address.length > 300)
    return fail("현장명과 주소를 확인해 주세요.");
  const { error } = await client
    .from("site_requests")
    .insert({ owner_id: user.id, name, address });
  if (error) return fail("요청을 저장하지 못했습니다.");
  revalidatePath("/manage");
  return {
    message: "현장 등록을 요청했습니다. 현장 추가 후 공고를 등록해 주세요.",
    ok: true,
  };
}
export async function operatorAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, admin } = await identity();
  if (!client || !admin) return fail("운영 권한이 필요합니다.");
  const target = String(form.get("id")),
    decision = String(form.get("decision")),
    reason = String(form.get("reason") || "").trim();
  if (!reason || reason.length > 1000)
    return fail("처리 사유를 입력해 주세요.");
  const result =
    form.get("kind") === "member"
      ? await client.rpc("set_member_status", { target, decision, reason })
      : await client.rpc("moderate_listing", { target, decision, reason });
  if (result.error)
    return fail("처리할 수 없습니다. 대상의 상태를 확인해 주세요.");
  revalidatePath("/");
  return { message: "처리 내용과 사유를 저장했습니다.", ok: true };
}
export async function saveProject(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, admin } = await identity();
  if (!client || !admin) return fail("운영 권한이 필요합니다.");
  const name = String(form.get("name") || "").trim(),
    address = String(form.get("address") || "").trim(),
    latitude = Number(form.get("latitude")),
    longitude = Number(form.get("longitude"));
  if (
    !name ||
    !address ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 33 ||
    latitude > 39 ||
    longitude < 124 ||
    longitude > 132
  )
    return fail("현장명·주소·국내 좌표를 확인해 주세요.");
  const value = {
    name,
    address,
    latitude,
    longitude,
    published: form.get("published") === "on",
    price: String(form.get("price") || "") || null,
    types: String(form.get("types") || "") || null,
    builder: String(form.get("builder") || "") || null,
    move_in: String(form.get("move_in") || "") || null,
    deposit: String(form.get("deposit") || "") || null,
    interim: String(form.get("interim") || "") || null,
    units: form.get("units") ? Number(form.get("units")) : null,
  };
  const id = String(form.get("id") || "");
  const { error } = id
    ? await client.from("projects").update(value).eq("id", id)
    : await client.from("projects").insert(value);
  if (error) return fail("현장정보를 저장하지 못했습니다.");
  revalidatePath("/");
  return { message: "현장정보를 저장했습니다.", ok: true };
}
