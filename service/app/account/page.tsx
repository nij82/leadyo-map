import Link from "next/link";
import { redirect } from "next/navigation";
import { identity } from "@/lib/supabase/server";
import { saveProfile, logout } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
export default async function Account() {
  const { client, user, profile } = await identity();
  if (!user) redirect("/login");
  const { data: status } = await client!.rpc("member_status");
  const terms = process.env.NEXT_PUBLIC_TERMS_URL,
    privacy = process.env.NEXT_PUBLIC_PRIVACY_URL,
    ready = !!(terms && privacy && process.env.LEGAL_VERSION);
  return (
    <main id="main" className="content narrow">
      <h1>{profile ? "내 계정" : "모집공고자 정보"}</h1>
      <p>{user.email}</p>
      {status === "suspended" && (
        <p className="notice">
          이용이 정지되었습니다. 공고 등록과 수정이 제한됩니다.
        </p>
      )}
      <ActionForm
        action={saveProfile}
        disabled={!ready || status === "suspended"}
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
        {ready ? (
          <label className="check">
            <input name="consent" type="checkbox" required />
            <span>
              <a href={terms} target="_blank" rel="noopener noreferrer">
                이용약관
              </a>
              과{" "}
              <a href={privacy} target="_blank" rel="noopener noreferrer">
                개인정보 처리 안내
              </a>
              를 확인하고 필수 사항에 동의합니다.
            </span>
          </label>
        ) : (
          <p className="notice">모집공고자 가입 안내를 준비하고 있습니다.</p>
        )}
      </ActionForm>
      {profile && (
        <Link className="button" href="/manage">
          내 공고
        </Link>
      )}
      <form action={logout}>
        <button>로그아웃</button>
      </form>
    </main>
  );
}
