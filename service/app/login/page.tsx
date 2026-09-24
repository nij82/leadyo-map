import { LoginForm } from "@/components/login-form";
export default function Login() {
  return (
    <main id="main" className="content narrow">
      <p className="eyebrow">모집공고자 전용</p>
      <h1>이메일로 시작하세요</h1>
      <p className="muted">
        가입과 로그인을 한 번에 진행합니다. 현장 탐색과 연락은 가입 없이 이용할
        수 있습니다.
      </p>
      <LoginForm
        enabled={
          !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        }
      />
    </main>
  );
}
