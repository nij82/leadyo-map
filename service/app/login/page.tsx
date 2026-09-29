import { LoginForm } from "@/components/login-form";
import Link from "next/link";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; project?: string }>;
}) {
  const { error, project } = await searchParams;
  return (
    <main id="main" className="content narrow">
      <p className="eyebrow">모집공고자 전용</p>
      <h1>로그인</h1>
      <p className="muted">
        모집공고자는 이메일과 비밀번호로 로그인합니다. 현장 탐색과 연락은 가입
        없이 이용할 수 있습니다.
      </p>
      <p className="muted">
        <Link href="/terms">이용약관</Link> ·{" "}
        <Link href="/privacy">개인정보 처리방침</Link>
      </p>
      {error === "link" && (
        <p className="notice" role="alert">
          이메일 인증 링크가 만료되었거나 사용할 수 없습니다. 새 링크를 요청해
          주세요.
        </p>
      )}
      <LoginForm
        projectId={project}
        enabled={
          !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        }
      />
      <p>
        처음 가입하거나 비밀번호를 아직 설정하지 않았나요?{" "}
        <Link href="/signup">이메일 인증 링크 받기</Link>
      </p>
    </main>
  );
}
