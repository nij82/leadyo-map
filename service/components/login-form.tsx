"use client";
import { useState } from "react";
import { emailLinkClient } from "@/lib/supabase/browser";
export function LoginForm({ enabled }: { enabled: boolean }) {
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit() {
    const c = emailLinkClient();
    if (!c) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await c.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      setSent(true);
      setMessage("이메일로 보낸 링크를 열어 주세요.");
    } catch {
      setMessage("메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form action={submit} className="form">
      <label>
        이메일
        <input
          type="email"
          required
          value={email}
          readOnly={sent}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <button className="primary" disabled={!enabled || busy}>
        {busy ? "처리 중…" : sent ? "로그인 링크 다시 보내기" : "로그인 링크 받기"}
      </button>
      {sent && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSent(false);
            setMessage("");
          }}
        >
          다른 이메일 사용
        </button>
      )}
      <p role="status">
        {message ||
          (!enabled
            ? "로그인 서비스를 준비하고 있습니다. 연결이 완료되면 이용할 수 있습니다."
            : "가입과 로그인에 사용할 링크를 입력한 이메일로 보냅니다.")}
      </p>
    </form>
  );
}
