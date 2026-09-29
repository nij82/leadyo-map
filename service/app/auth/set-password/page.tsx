import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/password-form";
import { serverClient } from "@/lib/supabase/server";

export default async function SetPassword() {
  const client = await serverClient();
  if (!client) redirect("/login");
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main id="main" className="content narrow">
      <h1>비밀번호 설정</h1>
      <p className="muted">
        {user.email} 계정으로 로그인할 때 사용할 비밀번호를 정해 주세요.
      </p>
      <PasswordForm />
    </main>
  );
}
