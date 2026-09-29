"use client";
import { useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (password !== confirmation) {
      setMessage("비밀번호가 일치하지 않습니다.");
      return;
    }
    const client = browserClient();
    if (!client) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      window.location.assign("/account");
    } catch {
      setMessage(
        "비밀번호를 설정하지 못했습니다. 다른 비밀번호로 다시 시도해 주세요.",
      );
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="form">
      <label>
        새 비밀번호
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label>
        비밀번호 확인
        <input
          type="password"
          required
          minLength={8}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      <button className="primary" disabled={busy}>
        {busy ? "설정 중…" : "비밀번호 설정하고 계속"}
      </button>
      <p className="muted">8자 이상으로 입력해 주세요.</p>
      <p role="alert" className="form-message">
        {message}
      </p>
    </form>
  );
}
