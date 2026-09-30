"use client";
import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions";
export function ActionForm({
  action,
  children,
  submit = "저장",
  disabled = false,
  submitDisabled = false,
  inDialog = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit?: string;
  disabled?: boolean;
  submitDisabled?: boolean;
  inDialog?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const dialog = form.current?.closest("dialog");
    if (inDialog && state.ok && dialog?.open) {
      window.alert("현장이 정상적으로 등록되었습니다.");
      dialog.close("saved");
    }
  }, [inDialog, state]);
  return (
    <form ref={form} action={formAction} className="form" aria-busy={pending}>
      <fieldset disabled={pending || disabled}>
        {children}
        {inDialog ? (
          <div className="project-create-actions">
            <button
              type="button"
              onClick={() => form.current?.closest("dialog")?.close("cancel")}
            >
              취소
            </button>
            <button className="primary" type="submit" disabled={submitDisabled}>
              {pending ? "저장 중…" : submit}
            </button>
          </div>
        ) : (
          <button className="primary" type="submit" disabled={submitDisabled}>
            {pending ? "처리 중…" : submit}
          </button>
        )}
      </fieldset>
      <p role="status" className={state.ok ? "success" : "form-message"}>
        {state.message}
      </p>
    </form>
  );
}
