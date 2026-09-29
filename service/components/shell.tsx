import Link from "next/link";
import Image from "next/image";
import { identity } from "@/lib/supabase/server";
export async function Header() {
  const { user, admin } = await identity();
  return (
    <header className="header">
      <Link className="brand" href="/">
        <Image
          src="/images/leadyo-logo.svg"
          alt="리드요"
          width={120}
          height={32}
          priority
        />
        <span className="brand-service">현장</span>
      </Link>
      <nav aria-label="주 메뉴">
        <Link href="/">분양 현장</Link>
        {user && <Link href="/manage">내 공고</Link>}
        {admin && <Link href="/admin">운영관리</Link>}
        <Link href={user ? "/account" : "/login"}>
          {user ? "내 계정" : "로그인"}
        </Link>
        <Link className="button primary" href="/manage?new=1">
          공고 등록
        </Link>
      </nav>
    </header>
  );
}
export function State({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="state">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
