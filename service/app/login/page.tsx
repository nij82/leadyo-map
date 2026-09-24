import { LoginForm } from "@/components/login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="main" className="content narrow">
      <p className="eyebrow">모집공고자 전용</p>
      <h1>이메일로 시작하세요</h1>
      <p className="muted">
        이메일로 받은 링크를 열면 가입 또는 로그인이 완료됩니다. 현장 탐색과
        연락은 가입 없이 이용할 수 있습니다.
      </p>
      {error === "link" && (
        <p className="notice" role="alert">
          로그인 링크가 만료되었거나 이 브라우저에서 사용할 수 없습니다. 새 링크를
          요청해 주세요.
        </p>
      )}
      <LoginForm
        enabled={
          !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        }
      />
    </main>
  );
}
