"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="content">
      <h1>정보를 불러오지 못했습니다</h1>
      <p>잠시 후 다시 시도해 주세요.</p>
      <button onClick={reset}>다시 시도</button>
    </main>
  );
}
