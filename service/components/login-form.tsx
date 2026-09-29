"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
export function LoginForm({
  enabled,
  projectId,
}: {
  enabled: boolean;
  projectId?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    const c = browserClient();
    if (!c) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await c.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.assign(
        projectId
          ? `/manage?new=1&project=${encodeURIComponent(projectId)}`
          : "/",
      );
    } catch {
      setMessage("이메일 또는 비밀번호를 확인해 주세요.");
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
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <label>
        비밀번호
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      <button className="primary" disabled={!enabled || busy}>
        {busy ? "로그인 중…" : "로그인"}
      </button>
      <p role="status" className={message ? "form-message" : "muted"}>
        {message ||
          (!enabled
            ? "로그인 서비스를 준비하고 있습니다. 연결이 완료되면 이용할 수 있습니다."
            : "")}
      </p>
    </form>
  );
}
