"use client";

import { useId, useRef, useState, type ReactNode } from "react";

export function ProjectCreateDialog({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [session, setSession] = useState(0);
  const [message, setMessage] = useState("");

  return (
    <div>
      <button
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        onClick={() => {
          setMessage("");
          if (dialog.current) {
            dialog.current.returnValue = "";
            dialog.current.showModal();
          }
        }}
      >
        새 현장 등록
      </button>
      <p className="sr-only" role="status">
        {message}
      </p>
      <dialog
        ref={dialog}
        className="project-create-dialog"
        aria-labelledby={titleId}
        onCancel={(event) => {
          if (dialog.current?.querySelector('form[aria-busy="true"]'))
            event.preventDefault();
        }}
        onClose={() => {
          if (dialog.current?.returnValue === "saved")
            setMessage("새 현장을 등록했습니다.");
          setSession((value) => value + 1);
          trigger.current?.focus();
        }}
      >
        <h2 id={titleId}>새 현장 등록</h2>
        <div key={session}>{children}</div>
      </dialog>
    </div>
  );
}
