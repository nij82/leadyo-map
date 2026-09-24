import Link from "next/link";
import { redirect } from "next/navigation";
import { identity } from "@/lib/supabase/server";
import { ActionForm } from "@/components/action-form";
import { ListingForm } from "@/components/listing-form";
import { setListingState, requestSite } from "@/app/actions";
import type { Listing, Project } from "@/lib/types";
export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  const { client, user, profile } = await identity();
  if (!user) redirect("/login");
  if (!profile) redirect("/account");
  const params = await searchParams;
  const [a, b, s] = await Promise.all([
    client!
      .from("listings")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    client!.from("projects").select("*").eq("published", true).order("name"),
    client!.rpc("member_status"),
  ]);
  if (a.error || b.error) throw new Error("Data unavailable");
  const listings: Listing[] = a.data || [],
    projects: Project[] = b.data || [],
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
        <Link className="button primary" href="/manage?new=1">
          공고 등록
        </Link>
      </div>
      {s.data === "suspended" ? (
        <p className="notice">
          이용 정지 중입니다. 기존 공고만 확인할 수 있습니다.
        </p>
      ) : params.new || edit ? (
        <section className="panel">
          <h2>{edit ? "공고 수정" : "새 공고"}</h2>
          {!projects.length && (
            <p className="notice">
              등록 가능한 현장이 없습니다. 아래에서 현장 등록을 요청해 주세요.
            </p>
          )}
          <ListingForm
            projects={projects}
            listing={edit}
            organization={profile.organization}
            phone={profile.phone}
          />
          <Link href="/manage">목록으로</Link>
        </section>
      ) : null}
      <div className="manage-list">
        {listings.map((j) => (
          <article className="panel" key={j.id}>
            <h2>
              {projects.find((p) => p.id === j.project_id)?.name ||
                "비공개 현장"}
            </h2>
            <p>
              {j.organization} ·{" "}
              {j.moderation === "visible"
                ? j.status === "published"
                  ? "게시 중"
                  : "모집 종료"
                : j.moderation === "hidden"
                  ? "운영자 숨김"
                  : "삭제됨"}
            </p>
            {j.moderation !== "deleted" && s.data === "active" && (
              <Link href={"/manage?edit=" + j.id}>공고 수정</Link>
            )}
            {j.moderation === "visible" && s.data === "active" && (
              <ActionForm
                action={setListingState}
                submit={j.status === "published" ? "모집 종료" : "재게시"}
              >
                <input type="hidden" name="id" value={j.id} />
                <input
                  type="hidden"
                  name="status"
                  value={j.status === "published" ? "closed" : "published"}
                />
              </ActionForm>
            )}
          </article>
        ))}
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
            아파트 현장명
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
