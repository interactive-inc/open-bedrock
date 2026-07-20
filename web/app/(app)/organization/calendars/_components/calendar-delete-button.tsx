"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteCalendarDayAction } from "@/app/(app)/organization/calendars/actions"
import type { CalendarActionState } from "@/app/(app)/organization/calendars/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 削除対象の会社カレンダー日 ID。hidden フィールドへ埋め込む。
  id: number
}

const initialState: CalendarActionState = { ok: false, error: null }

/** 会社カレンダーの 1 日を削除するボタン（calendar:manage 保持者にのみ表示する）。 */
export function CalendarDeleteButton(props: Props) {
  async function reduce(
    previousState: CalendarActionState,
    formData: FormData,
  ): Promise<CalendarActionState> {
    const result = await deleteCalendarDayAction(previousState, formData)

    if (result.ok) {
      toast.success("削除しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={props.id} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
