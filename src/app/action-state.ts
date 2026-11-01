/**
 * Shared shape for server-action results.
 *
 * This lives outside actions.ts on purpose: a "use server" module may only
 * export async functions, so the constant below cannot live there.
 */
export interface ActionState {
  ok: boolean;
  message?: string;
  warnings?: string[];
}

export const EMPTY_STATE: ActionState = { ok: true };
