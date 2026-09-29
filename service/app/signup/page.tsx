import Link from "next/link";
import { SignupForm } from "@/components/signup-form";

export default function Signup() {
  return (
    <main id="main" className="content narrow">
      <p className="eyebrow">모집공고자 전용</p>
      <h1>이메일 인증으로 가입</h1>
      <p className="muted">
        이메일로 받은 링크를 열어 본인 인증을 마치고 비밀번호를 설정해 주세요.
        기존에 링크로만 로그인했다면 같은 이메일로 링크를 받아 비밀번호를 설정할
        수 있습니다.
      </p>
      <p className="muted">
        <Link href="/terms">이용약관</Link> ·{" "}
        <Link href="/privacy">개인정보 처리방침</Link>
      </p>
      <SignupForm
        enabled={
          !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
          !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        }
      />
      <p>
        이미 비밀번호가 있나요? <Link href="/login">로그인</Link>
      </p>
    </main>
  );
}
