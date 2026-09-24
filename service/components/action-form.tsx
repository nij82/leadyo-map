"use client";
import { useActionState } from "react";
import type { ActionState } from "@/app/actions";
export function ActionForm({
  action,
  children,
  submit = "저장",
  disabled = false,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  submit?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  return (
    <form action={formAction} className="form">
      <fieldset disabled={pending || disabled}>
        {children}
        <button className="primary" type="submit">
          {pending ? "처리 중…" : submit}
        </button>
      </fieldset>
      <p role="status" className={state.ok ? "success" : "form-message"}>
        {state.message}
      </p>
    </form>
  );
}
