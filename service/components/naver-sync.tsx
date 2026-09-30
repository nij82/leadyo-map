"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Held = { name: string; reason: string };
export function NaverSync() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("");
  const [held, setHeld] = useState<Held[]>([]);
  const busy = useRef(false);
  const apply = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    setFinished(false);
    try {
      for (;;) {
        setMessage(
          "보류 현장 상세 재확인 → 기존 사업지 대조 → 등록·현장명 갱신 중입니다.",
        );
        const response = await fetch("/api/admin/naver-hold-review", {
          method: "POST",
        });
        const data = await response.json();
        if (data.held) setHeld(data.held);
        if (!response.ok)
          throw new Error(data.error || "등록 연결을 확인해 주세요.");
        setMessage(
          `${data.region || "경기도"} · 상세 ${data.collected}개 수집 · 대조 ${Math.min(data.nextIndex, data.total)}개 · 등록 ${data.inserted}, 현장명 갱신 ${data.renamed || 0}, 기존 ${data.skipped}, 보류 ${data.held.length}, 범위 밖 ${data.excluded || 0}`,
        );
        if (data.done) {
          setFinished(true);
          break;
        }
        setMessage(
          `${data.region || "경기도"} · 상세 ${data.collected}개 수집 · 등록 ${data.inserted}, 현장명 갱신 ${data.renamed || 0}, 기존 ${data.skipped}, 보류 ${data.held.length}, 범위 밖 ${data.excluded || 0} · 30초 뒤 계속합니다.`,
        );
        await new Promise((resolve) => setTimeout(resolve, 30_000));
      }
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "연결 오류"} 진행 상태는 유지됩니다. 원인을 해결한 뒤 같은 버튼으로 이어갈 수 있습니다.`,
      );
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const response = await fetch(
          "/api/admin/naver-hold-review?job=holds-reviewed-v2",
          {
            cache: "no-store",
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!active) return;
        setHeld(data.held);
        setFinished(data.done);
        if (data.error)
          setMessage(`작업 중단: ${data.error}. 진행 기록은 보존되었습니다.`);
        if (data.done)
          setMessage(
            `보류 현장 검토 완료 · 수집 ${data.collected}, 등록 ${data.inserted}, 현장명 갱신 ${data.renamed || 0}, 기존 ${data.skipped}, 보류 ${data.held.length}, 범위 밖 ${data.excluded || 0}개`,
          );
        else if (data.resume) {
          setMessage("이미 시작한 등록 작업을 자동으로 재개합니다.");
          await apply();
        }
      } catch (error) {
        if (active)
          setMessage(
            error instanceof Error ? error.message : "진행 상태 확인 실패",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [apply]);

  if (loading && !running) return null;
  if (finished) {
    if (!held.length) return null;
    return (
      <details className="admin-create">
        <summary>등록 보류 현장 {held.length}건</summary>
        <p>현장 동일성이나 현재 공급 상태를 추가 확인해야 하는 항목입니다.</p>
        <ul>
          {held.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              {item.name} · {item.reason}
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <div className="notice">
      <strong>등록 보류 현장 재검토</strong>
      <p>
        보류 현장을 네이버 부동산 상세와 다시 대조합니다. 신규 현장은 등록하고,
        같은 사업지의 변경된 현장명은 기존 항목을 갱신합니다. 20개씩 처리하며
        묶음 사이 30초 간격으로 이어갑니다.
      </p>
      <p>
        동일성이나 현재 분양 상태가 불확실한 항목은 사유를 남깁니다. 관리자
        화면을 열어 두면 검토부터 등록까지 계속 진행합니다.
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={apply}
          disabled={loading || running || finished}
        >
          {running
            ? "자동 진행 중"
            : finished
              ? "처리 완료"
              : "대조부터 등록까지 시작"}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {held.length > 0 && (
        <details>
          <summary>검토 보류 {held.length}개</summary>
          <ul>
            {held.map((item, index) => (
              <li key={`${item.name}-${index}`}>
                {item.name} · {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
