import Link from "next/link";
import { redirect } from "next/navigation";
import { identity } from "@/lib/supabase/server";
import { saveProfile, logout } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const { client, user, profile } = await identity();
  if (!user)
    redirect(
      project ? `/login?project=${encodeURIComponent(project)}` : "/login",
    );
  const { data: status } = await client!.rpc("member_status");
  const ready = !!process.env.LEGAL_VERSION;
  const draft = process.env.LEGAL_VERSION?.endsWith("-local-draft");
  return (
    <main id="main" className="content narrow">
      <h1>{profile ? "내 계정" : "모집공고자 정보"}</h1>
      <p>{user.email}</p>
      {status === "suspended" && (
        <p className="notice">
          이용이 정지되었습니다. 공고 등록과 수정이 제한됩니다.
        </p>
      )}
      {!profile && !ready && (
        <p className="notice">
          <a href="/terms">이용약관</a>과{" "}
          <a href="/privacy">개인정보 처리방침</a>
          초안을 검토 중입니다. 정보를 입력할 수 있지만 검토가 끝나기 전에는
          저장되지 않습니다.
        </p>
      )}
      {!profile && draft && (
        <p className="notice">
          현재 시험 운영 문서에 동의하는 로컬 가입입니다. 입력한 정보는 연결된
          Supabase 프로젝트에 저장됩니다.
        </p>
      )}
      <ActionForm
        action={saveProfile}
        disabled={status === "suspended"}
        submitDisabled={!profile && !ready}
        submit={profile ? "정보 수정" : "모집공고자 가입 완료"}
      >
        <label>
          담당자명
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={profile?.name}
          />
        </label>
        <label>
          조직명 또는 활동명
          <input
            name="organization"
            required
            maxLength={100}
            defaultValue={profile?.organization}
          />
        </label>
        <label>
          연락처
          <input
            name="phone"
            type="tel"
            required
            defaultValue={profile?.phone}
          />
        </label>
        {!profile && ready && (
          <>
            <label className="check">
              <input name="terms_consent" type="checkbox" required />
              <span>
                <a href="/terms" target="_blank" rel="noopener noreferrer">
                  이용약관
                </a>
                에 동의합니다. (필수)
              </span>
            </label>
            <p className="muted">
              수집 항목: 이메일·비밀번호·담당자명·조직명 또는 활동명·연락처.
              목적: 모집공고자 계정 및 공고 운영. 보유기간: 탈퇴 처리 시까지.
              동의를 거부할 수 있으나 공고 등록은 이용할 수 없습니다.
            </p>
            <label className="check">
              <input name="privacy_consent" type="checkbox" required />
              <span>
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  개인정보 수집·이용 안내
                </a>
                를 확인하고 동의합니다. (필수)
              </span>
            </label>
          </>
        )}
      </ActionForm>
      {profile && (
        <p className="muted">
          <a href="/terms">이용약관</a> ·{" "}
          <a href="/privacy">개인정보 처리방침</a>
        </p>
      )}
      {profile && project && (
        <Link
          className="button"
          href={`/manage?new=1&project=${encodeURIComponent(project)}`}
        >
          선택한 현장 공고 등록
        </Link>
      )}
      <form action={logout}>
        <button>로그아웃</button>
      </form>
    </main>
  );
}
