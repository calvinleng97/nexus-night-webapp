"use client";

import { useActionState, useState, type ReactNode } from "react";
import { EMPTY_STATE, type ActionState } from "@/app/action-state";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

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
  confirm,
  children,
  className = "",
  compact = false,
}: {
  action: Action;
  fields?: Record<string, string | number>;
  label: string;
  variant?: "default" | "primary" | "danger" | "ghost";
  confirm?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_STATE);
  const [armed, setArmed] = useState(false);

  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50";
  const variants = {
    default: "border-line bg-panel-2 hover:border-accent-dim",
    primary: "border-accent-dim bg-accent/15 text-accent hover:bg-accent/25",
    danger: "border-loss/50 bg-loss/10 text-loss hover:bg-loss/20",
    ghost: "border-transparent text-muted hover:text-white",
  } as const;

  return (
    <form action={formAction} className={className}>
      {Object.entries(fields ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={String(v)} />
      ))}
      {children}
      <button
        type={confirm && !armed ? "button" : "submit"}
        onClick={confirm && !armed ? () => setArmed(true) : undefined}
        disabled={pending}
        className={`${base} ${variants[armed ? "danger" : variant]} ${compact ? "" : "w-full sm:w-auto"}`}
      >
        {pending ? "Working…" : armed ? confirm : label}
      </button>
      {armed ? (
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="ml-2 text-xs text-muted underline"
        >
          cancel
        </button>
      ) : null}
      {state.message && !state.ok ? (
        <p role="alert" className="mt-2 text-sm text-loss">
          {state.message}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="mt-2 text-sm text-win">{state.message}</p>
      ) : null}
      {state.warnings?.length ? (
        <ul className="mt-2 space-y-1 text-sm text-draw">
          {state.warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
