"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { EMPTY_STATE, type ActionState } from "@/app/action-state";
import { btn, type ButtonSize, type ButtonVariant } from "./ui";

export type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action, with inline pending state and error
 * reporting. `confirm` turns the submit into a two-tap action so a mis-tap
 * mid-event can't drop a player.
 */
export function ActionForm({
  action,
  fields,
  label,
  variant = "default",
  size = "md",
  full,
  confirm,
  children,
  className = "",
}: {
  action: Action;
  fields?: Record<string, string | number>;
  label: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch the button to the form's width. Large buttons do by default. */
  full?: boolean;
  confirm?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_STATE);
  const [armed, setArmed] = useState(false);
  // A finished submission disarms: the confirm step is for one action, not a mode.
  useEffect(() => setArmed(false), [state]);
  const stretch = full ?? size === "lg";

  return (
    <form action={formAction} className={className}>
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      {children}
      <div className={`flex items-center gap-2 ${stretch ? "w-full" : ""}`}>
        <button
          type={confirm && !armed ? "button" : "submit"}
          onClick={confirm && !armed ? () => setArmed(true) : undefined}
          disabled={pending}
          className={`${btn(armed ? (variant === "solid" ? "solid" : "solidDanger") : variant, size, stretch)} ${stretch ? "flex-1" : ""}`}
        >
          {pending ? "Working…" : armed ? confirm : label}
        </button>
        {armed && !pending ? (
          <button
            type="button"
            onClick={() => setArmed(false)}
            className={btn("ghost", size === "lg" ? "lg" : size)}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <ActionMessages state={state} />
    </form>
  );
}

export function ActionMessages({ state }: { state: ActionState }) {
  return (
    <>
      {state.message && !state.ok ? (
        <p role="alert" className="mt-2 text-sm text-loss">
          {state.message}
        </p>
      ) : null}
      {state.warnings?.length ? (
        <ul className="mt-2 space-y-1 text-sm text-draw">
          {state.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
