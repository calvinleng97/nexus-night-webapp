import { setEventDateAction } from "@/app/actions";
import { ActionForm } from "./action-form";
import { inputClass } from "./ui";

/** Manager control for scheduling or rescheduling an event. */
export function EventDateControl({
  eventId,
  value,
}: {
  eventId: string;
  value: string | null;
}) {
  return (
    <ActionForm
      action={setEventDateAction}
      fields={{ eventId }}
      label="Save"
      className="flex flex-wrap items-center gap-2 [&>p]:basis-full [&>ul]:basis-full"
    >
      <input
        type="datetime-local"
        name="scheduledFor"
        aria-label="Date and time"
        defaultValue={value ?? ""}
        className={`${inputClass} h-10 min-w-0 flex-1 !py-0`}
      />
    </ActionForm>
  );
}
