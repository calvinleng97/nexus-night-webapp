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
  size = "md",
  confirm,
  children,
  className = "",
  compact = false,
}: {
  action: Action;
  fields?: Record<string, string | number>;
  label: string;
  variant?: "default" | "primary" | "solid" | "danger" | "solidDanger" | "ghost";
  size?: "md" | "lg";
  confirm?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_STATE);
  const [armed, setArmed] = useState(false);

  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors disabled:opacity-50";
  const sizes = {
    md: "px-3.5 py-2 text-sm",
    lg: "w-full px-5 py-3.5 text-[0.95rem] font-semibold",
  } as const;
  const variants = {
    default: "border-hair bg-raised text-fg hover:border-accent/40",
    primary: "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20",
    // The strongest call to action on a page: filled, dark text on gold.
    solid: "border-accent bg-accent text-ink hover:bg-accent/90",
    danger: "border-loss/45 bg-loss/10 text-loss hover:bg-loss/20",
    // The filled counterpart of `solid`, for undoing it (Join → Leave).
    solidDanger: "border-loss bg-loss text-ink hover:bg-loss/90",
    ghost: "border-transparent text-fg-faint hover:text-fg",
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
        className={`${base} ${sizes[size]} ${variants[armed ? "danger" : variant]} ${
          compact || size === "lg" ? "" : "w-full sm:w-auto"
        }`}
      >
        {pending ? "Working…" : armed ? confirm : label}
      </button>
      {armed ? (
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="ml-2 text-xs text-fg-faint underline"
        >
          cancel
        </button>
      ) : null}
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
    </form>
  );
}
