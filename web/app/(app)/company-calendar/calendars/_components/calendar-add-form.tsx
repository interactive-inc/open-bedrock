"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createCalendarDayAction } from "@/app/(app)/company-calendar/calendars/actions"
import type { CalendarActionState } from "@/app/(app)/company-calendar/calendars/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

const initialState: CalendarActionState = { ok: false, error: null }

/** 会社休日・振替出勤日の登録フォーム（calendar:manage 保持者にのみ表示する）。 */
export function CalendarAddForm() {
  async function reduce(
    previousState: CalendarActionState,
    formData: FormData,
  ): Promise<CalendarActionState> {
    const result = await createCalendarDayAction(previousState, formData)

    if (result.ok) {
      toast.success("会社カレンダーに登録しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-2xl bg-card border p-4"
    >
      <Field className="w-44">
        <FieldLabel htmlFor="calendar-date">日付</FieldLabel>

        <Input id="calendar-date" name="calendar_date" type="date" required />
      </Field>

      <Field className="w-40">
        <FieldLabel htmlFor="calendar-kind">種別</FieldLabel>

        <NativeSelect id="calendar-kind" name="kind" defaultValue="holiday" className="w-40">
          <NativeSelectOption value="holiday">会社休日</NativeSelectOption>

          <NativeSelectOption value="workday">振替出勤日</NativeSelectOption>
        </NativeSelect>
      </Field>

      <Field className="w-56">
        <FieldLabel htmlFor="calendar-name">名称</FieldLabel>

        <Input id="calendar-name" name="name" placeholder="任意（例: 創立記念日）" />
      </Field>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "登録中..." : "登録"}
      </Button>
    </form>
  )
}
