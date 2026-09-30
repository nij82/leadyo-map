"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Held = { name: string; reason: string };
export function NaverImport() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [message, setMessage] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [held, setHeld] = useState<Held[]>([]);
  const busy = useRef(false);
  const apply = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(true);
    try {
      for (;;) {
        setMessage("등록 작업을 이어가는 중입니다.");
        const response = await fetch("/api/admin/naver-import", {
          method: "POST",
        });
        const data = await response.json();
        if (data.held) setHeld(data.held);
        if (!response.ok)
          throw new Error(data.error || "등록 연결을 확인해 주세요.");
        setMessage(
          `${data.nextIndex} / ${data.total}개 처리 · 등록 ${data.inserted}, 기존 ${data.skipped}, 보류 ${data.held.length}`,
        );
        if (data.done) {
          setFinished(true);
          break;
        }
        setMessage(
          `${data.nextIndex} / ${data.total}개 처리 · 30초 뒤 다음 묶음을 계속합니다.`,
        );
        await new Promise((resolve) => setTimeout(resolve, 30_000));
      }
    } catch (error) {
      setMessage(
        `${error instanceof Error ? error.message : "연결 오류"} 진행 상태는 유지되며, 관리자 화면에 다시 들어오면 이어갑니다.`,
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
        const response = await fetch("/api/admin/naver-import", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!active) return;
        setNames(data.projects);
        setHeld(data.held);
        setFinished(data.done);
        if (data.done)
          setMessage(
            `등록 작업 완료 · 현재 등록 ${data.registered} / ${data.total}개, 보류 ${data.held.length}개`,
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

  return (
    <div className="notice">
      <strong>네이버 대조 현장 등록</strong>
      <p>
        검증한 현장만 20개씩 처리합니다. 개별 문제는 보류하고 나머지는 계속하며,
        이미 시작한 작업은 이 화면에서 자동으로 이어갑니다.
      </p>
      <p>
        이번 자료는 현장명·주소·좌표·공급유형·입주예정월이며 공고 상세는 후속
        연결 대상입니다.
      </p>
      <details>
        <summary>등록 대상 {names.length}개 보기</summary>
        <ul>
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </details>
      <div className="actions">
        <button
          type="button"
          onClick={apply}
          disabled={loading || running || finished}
        >
          {running ? "자동 진행 중" : finished ? "처리 완료" : "등록 시작"}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {held.length > 0 && (
        <details>
          <summary>검토 보류 {held.length}개</summary>
          <ul>
            {held.map((item) => (
              <li key={item.name}>
                {item.name} · {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
