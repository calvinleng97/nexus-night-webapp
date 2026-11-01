import { setEventDateAction } from "@/app/actions";
import { ActionForm } from "./action-form";
import { MicroLabel } from "./ui";

/** Manager control for scheduling or rescheduling an event. */
export function EventDateControl({
  eventId,
  value,
}: {
  eventId: string;
  value: string | null;
}) {
  return (
    <div>
      <MicroLabel>{value ? "Reschedule" : "Set a date"}</MicroLabel>
      <ActionForm
        action={setEventDateAction}
        fields={{ eventId }}
        label="Save date"
        compact
        className="mt-2"
      >
        <input
          type="datetime-local"
          name="scheduledFor"
          defaultValue={value ?? ""}
          className="mb-2 w-full rounded-xl border border-hair bg-ink px-3 py-2 text-sm text-fg outline-none focus:border-accent/50 sm:w-auto"
        />
      </ActionForm>
    </div>
  );
}
