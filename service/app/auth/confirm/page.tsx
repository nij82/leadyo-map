"use client";

import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

export default function ConfirmEmailLink() {
  const [message, setMessage] = useState("로그인을 확인하고 있습니다…");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    window.history.replaceState(null, "", "/auth/confirm");

    if (!access_token || !refresh_token) {
      window.location.replace("/login?error=link");
      return;
    }

    const client = browserClient();
    if (!client) {
      setMessage("로그인 서비스를 연결하지 못했습니다.");
      return;
    }

    void client.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) window.location.replace("/login?error=link");
        else window.location.replace("/account");
      })
      .catch(() => window.location.replace("/login?error=link"));
  }, []);

  return (
    <main id="main" className="content narrow">
      <h1>이메일 로그인</h1>
      <p role="status">{message}</p>
    </main>
  );
}
