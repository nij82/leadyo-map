"use client";
import { useEffect, useState } from "react";

export function ApplyhomeImport() {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/admin/applyhome-import")
      .then((response) => response.ok ? response.json() : null)
      .then((data: { total: number; applied: number } | null) => {
        if (data && data.applied === data.total) {
          setFinished(true);
          setMessage(`${data.total.toLocaleString("ko-KR")}개 현장에 자료가 적용되어 있습니다.`);
        }
      })
      .catch(() => setMessage("자료 적용 상태를 확인하지 못했습니다."));
  }, []);

  async function start() {
    setRunning(true);
    setMessage("수집 자료를 확인하는 중입니다.");
    try {
      const response = await fetch("/api/admin/applyhome-import");
      if (!response.ok) throw new Error("수집 자료를 확인하지 못했습니다.");
      const { total, batches } = (await response.json()) as {
        total: number;
        batches: number;
      };
      let updated = 0;
      for (let batch = 0; batch < batches; batch++) {
        const result = await fetch("/api/admin/applyhome-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch }),
        });
        const data = await result.json();
        if (!result.ok) throw new Error(data.error || "현장 갱신에 실패했습니다.");
        updated += data.updated;
        setMessage(`${updated.toLocaleString("ko-KR")} / ${total.toLocaleString("ko-KR")}개 현장 적용`);
      }
      setFinished(true);
      setMessage(`${total.toLocaleString("ko-KR")}개 현장의 청약홈 자료를 적용했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "현장 갱신에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="notice">
      <strong>청약홈 현장 상세 자료</strong>
      <p>검토된 544개 현장에 공고·주택형 정보를 연결합니다. 기존 수기 입력값은 유지됩니다.</p>
      <button type="button" onClick={start} disabled={running || finished}>
        {running ? "적용 중" : finished ? "적용 완료" : "수집 자료 적용"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
