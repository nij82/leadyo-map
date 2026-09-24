"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/browser";
export function LoginForm({ enabled }: { enabled: boolean }) {
  const router = useRouter(),
    [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(f: FormData) {
    const c = browserClient();
    if (!c) return;
    setBusy(true);
    setMessage("");
    try {
      if (!sent) {
        const { error } = await c.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
        });
        if (error) throw error;
        setSent(true);
        setMessage("이메일로 받은 인증번호를 입력해 주세요.");
      } else {
        const { error } = await c.auth.verifyOtp({
          email,
          token: String(f.get("token")).trim(),
          type: "email",
        });
        if (error) throw error;
        router.replace("/account");
        router.refresh();
      }
    } catch {
      setMessage(
        sent
          ? "인증번호가 유효하지 않거나 만료되었습니다. 다시 확인해 주세요."
          : "메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
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
      {sent && (
        <label>
          인증번호
          <input
            name="token"
            inputMode="numeric"
            pattern="[0-9]{6,10}"
            required
            autoComplete="one-time-code"
          />
        </label>
      )}
      <button className="primary" disabled={!enabled || busy}>
        {busy ? "처리 중…" : sent ? "인증 완료" : "인증번호 받기"}
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
          이메일 변경·다시 받기
        </button>
      )}
      <p role="status">
        {message ||
          (!enabled
            ? "로그인 서비스를 준비하고 있습니다. 연결이 완료되면 이용할 수 있습니다."
            : "인증번호는 입력한 이메일로만 발송됩니다.")}
      </p>
    </form>
  );
}
