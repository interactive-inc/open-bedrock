"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createLeaveRequestAction } from "@/app/(app)/leave/actions"
import type { LeaveActionState } from "@/app/(app)/leave/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"

const initialState: LeaveActionState = { ok: false, error: null }

// 休暇申請フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function LeaveRequestCreateForm() {
  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: LeaveActionState,
    formData: FormData,
  ): Promise<LeaveActionState> {
    const result = await createLeaveRequestAction(previousState, formData)

    if (result.ok) {
      toast.success("休暇申請を提出しました")
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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-4">
      <h3 className="text-lg font-medium">休暇を申請</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="leave-type">休暇種別</FieldLabel>

          <NativeSelect id="leave-type" name="leave_type" defaultValue="annual" className="w-full">
            <NativeSelectOption value="annual">年次有給</NativeSelectOption>

            <NativeSelectOption value="special">特別休暇</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="leave-reason">理由</FieldLabel>

          <Input id="leave-reason" name="reason" placeholder="任意" />
        </Field>

        <Field>
          <FieldLabel htmlFor="leave-start">開始日</FieldLabel>

          <Input id="leave-start" name="start_date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="leave-end">終了日</FieldLabel>

          <Input id="leave-end" name="end_date" type="date" required />
        </Field>
      </div>

      <FieldDescription>
        開始日と終了日から日数が自動計算され、承認後に残日数へ反映されます
      </FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner className="mr-2" /> : null}
          {isPending ? "提出中..." : "申請する"}
        </Button>
      </div>
    </form>
  )
}
