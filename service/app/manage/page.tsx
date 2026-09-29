import Link from "next/link";
import { redirect } from "next/navigation";
import { identity } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { ListingForm } from "@/components/listing-form";
import { setListingState, requestSite } from "@/app/actions";
import { productLabels, type Listing, type Project } from "@/lib/types";
import { displayProjectName } from "@/lib/project-name";
export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string; project?: string }>;
}) {
  const params = await searchParams;
  const projectQuery =
    params.new && params.project
      ? `?project=${encodeURIComponent(params.project)}`
      : "";
  const { client, user, profile } = await identity();
  if (!user) redirect(`/login${projectQuery}`);
  if (!profile) redirect(`/account${projectQuery}`);
  const [a, s] = await Promise.all([
    client!
      .from("listings")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    client!.rpc("member_status"),
  ]);
  if (a.error) throw new Error("Data unavailable");
  const projects: Project[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await client!
      .from("projects")
      .select(
        "id,name,address,latitude,longitude,units,types,price,move_in,deposit,interim,builder,published,showroom_address,product_details",
      )
      .eq("published", true)
      .order("name")
      .order("id")
      .range(offset, offset + 999);
    if (result.error) throw new Error("Data unavailable");
    projects.push(
      ...((result.data || []) as Project[]).map((project) => ({
        ...project,
        name: displayProjectName(project.name),
      })),
    );
    if (!result.data || result.data.length < 1000) break;
  }
  const listings: Listing[] = a.data || [],
    edit = listings.find((j) => j.id === params.edit);
  return (
    <main id="main" className="content">
      <div className="page-heading">
        <div>
          <h1>내 공고</h1>
          <p className="muted">
            등록하면 바로 게시됩니다. 문의는 전화·카카오톡으로 직접 받습니다.
          </p>
        </div>
        {!params.new && !edit && (
          <Link className="button primary" href="/manage?new=1">
            공고 등록
          </Link>
        )}
      </div>
      {s.data === "suspended" ? (
        <p className="notice">
          이용 정지 중입니다. 기존 공고만 확인할 수 있습니다.
        </p>
      ) : params.new || edit ? (
        <section className="panel">
          <h2>{edit ? "공고 수정" : "기본 정보"}</h2>
          {!projects.length && (
            <p className="notice">
              등록 가능한 현장이 없어 아직 공고를 게시할 수 없습니다. 아래에서
              현장 등록을 요청해 주세요.
            </p>
          )}
          <ListingForm
            key={edit?.id || params.project || "new"}
            projects={projects}
            listing={edit}
            preselectedProjectId={params.new ? params.project : undefined}
            organization={profile.organization}
            phone={profile.phone}
          />
          <Link href="/manage">목록으로</Link>
        </section>
      ) : null}
      <div className="manage-list">
        {listings.map((j) => {
          const status =
            j.moderation === "visible"
              ? j.status === "published"
                ? "게시 중"
                : "모집 종료"
              : j.moderation === "hidden"
                ? "운영자 숨김"
                : "삭제됨";
          const statusClass =
            j.moderation === "visible" ? j.status : j.moderation;
          return (
            <article
              className={`panel manage-card manage-card--${statusClass}`}
              key={j.id}
            >
              <div className="manage-card-head">
                <h2>
                  {projects.find((p) => p.id === j.project_id)?.name ||
                    "비공개 현장"}
                </h2>
                <span
                  className={`manage-card-status manage-card-status--${statusClass}`}
                >
                  {status}
                </span>
              </div>
              <p className="manage-card-organization">{j.organization}</p>
              <div className="manage-card-facts">
                <span>
                  {j.product_type
                    ? productLabels[j.product_type]
                    : "상품 유형 미확인"}
                </span>
                <span>
                  등록{" "}
                  {new Date(j.created_at).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </span>
              </div>
              {j.moderation !== "deleted" && s.data === "active" && (
                <div className="manage-card-actions">
                  <Link
                    className="button manage-card-edit"
                    href={"/manage?edit=" + j.id}
                  >
                    공고 수정
                  </Link>
                  {j.moderation === "visible" && (
                    <ActionForm
                      action={setListingState}
                      submit={j.status === "published" ? "모집 종료" : "재게시"}
                    >
                      <input type="hidden" name="id" value={j.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={
                          j.status === "published" ? "closed" : "published"
                        }
                      />
                    </ActionForm>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {!listings.length && (
          <p className="notice">아직 등록한 공고가 없습니다.</p>
        )}
      </div>
      <details className="panel">
        <summary>목록에 현장이 없나요? 현장 등록 요청</summary>
        <ActionForm
          action={requestSite}
          submit="현장 등록 요청"
          disabled={s.data !== "active"}
        >
          <label>
            분양 현장명
            <input name="name" required maxLength={150} />
          </label>
          <label>
            현장 주소
            <input name="address" required maxLength={300} />
          </label>
        </ActionForm>
      </details>
    </main>
  );
}
