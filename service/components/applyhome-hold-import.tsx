"use client";

import { useState } from "react";

export function ApplyhomeHoldImport() {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("");

  async function start() {
    setRunning(true);
    setMessage("검토된 현장 자료를 확인하는 중입니다.");
    try {
      const response = await fetch("/api/admin/applyhome-hold-import");
      if (!response.ok) throw new Error("검토된 현장 자료를 확인하지 못했습니다.");
      const { total, batches } = (await response.json()) as {
        total: number;
        batches: number;
      };
      let inserted = 0;
      let skipped = 0;
      for (let batch = 0; batch < batches; batch++) {
        const result = await fetch("/api/admin/applyhome-hold-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch }),
        });
        const data = await result.json();
        if (!result.ok) throw new Error(data.error || "현장 등록에 실패했습니다.");
        inserted += data.inserted;
        skipped += data.skipped;
        setMessage(`${inserted + skipped} / ${total}개 현장 적용`);
      }
      setFinished(true);
      setMessage(`${inserted}개 현장을 등록했습니다. ${skipped}개는 이미 등록되어 건너뛰었습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "현장 등록에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="notice">
      <strong>보류 현장 검색 대조 등록</strong>
      <p>호갱노노 검색에서 현장명·상품 유형·주소 또는 좌표가 하나로 일치한 192개 현장을 등록합니다.</p>
      <button type="button" onClick={start} disabled={running || finished}>
        {running ? "등록 중" : finished ? "등록 완료" : "검토 현장 등록"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
