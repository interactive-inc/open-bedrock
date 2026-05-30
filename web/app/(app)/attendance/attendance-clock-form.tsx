"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { clockInAction, clockOutAction } from "@/app/(app)/attendance/actions"
import type { AttendanceActionState } from "@/app/(app)/attendance/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  // 打刻種別。clock-in=出勤 / clock-out=退勤。
  mode: "clock-in" | "clock-out"
}

const initialState: AttendanceActionState = { ok: false, error: null }

// 打刻フォーム。mode に応じて出勤 / 退勤の Server Action を useActionState 経由で呼ぶ。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function AttendanceClockForm(props: Props) {
  const isClockIn = props.mode === "clock-in"

  const label = isClockIn ? "出勤" : "退勤"

  // useActionState の reducer。mode に応じた Server Action を実行し結果を次の state にする。
  async function reduce(
    previousState: AttendanceActionState,
    formData: FormData,
  ): Promise<AttendanceActionState> {
    const result = isClockIn
      ? await clockInAction(previousState, formData)
      : await clockOutAction(previousState, formData)

    if (result.ok) {
      toast.success(`${label}を打刻しました`)
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
    <form action={formAction} className="flex flex-col gap-3 rounded-2xl border p-4">
      <h2 className="text-lg font-medium">{label}打刻</h2>

      <Field>
        <FieldLabel htmlFor={`${props.mode}-note`}>メモ</FieldLabel>

        <Input id={`${props.mode}-note`} name="note" placeholder="任意" />
      </Field>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <Field orientation="horizontal">
        <Button type="submit" variant={isClockIn ? "default" : "outline"} disabled={isPending}>
          {isPending ? `${label}打刻中...` : `${label}を打刻`}
        </Button>
      </Field>
    </form>
  )
}
