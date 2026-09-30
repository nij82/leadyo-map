"use client";
import { useState } from "react";

export function UnsoldImport() {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("");
  const [names, setNames] = useState<string[]>([]);
  async function preview() {
    try {
      const response = await fetch("/api/admin/unsold-import");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNames(data.projects);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "자료 확인에 실패했습니다.",
      );
    }
  }
  async function apply() {
    setRunning(true);
    setMessage("검토된 현장의 미분양 근거를 저장 중입니다.");
    try {
      const response = await fetch("/api/admin/unsold-import", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          `${data.updated || 0}개 반영 후 중단: ${data.error} 다시 실행하면 반영한 현장은 건너뜁니다.`,
        );
      setFinished(true);
      setMessage(
        `${data.updated}개 반영, ${data.skipped}개 이미 반영 또는 최신 자료 유지. 총 ${data.total}개 현장을 확인했습니다.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "반영에 실패했습니다.",
      );
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="notice">
      <strong>경기도 미분양 정보 · 2026.08 기준</strong>
      <p>
        주소가 일치하는 기존 현장 17개에 경기도청의 미분양 확인 근거를
        연결합니다. 보류 자료 104개는 반영하지 않습니다.
      </p>
      <div className="actions">
        <button type="button" onClick={preview} disabled={running}>
          대상 현장 보기
        </button>
        <button type="button" onClick={apply} disabled={running || finished}>
          {running
            ? "반영 중"
            : finished
              ? "반영 완료"
              : "경기도 미분양 정보 반영"}
        </button>
      </div>
      {names.length > 0 && (
        <ul>
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
