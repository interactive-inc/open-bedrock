"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createResignationAction } from "@/app/(app)/resignations/actions"
import type { ResignationActionState } from "@/app/(app)/resignations/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: ResignationActionState = { ok: false, error: null }

// 退職申請フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function ResignationCreateForm() {
  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: ResignationActionState,
    formData: FormData,
  ): Promise<ResignationActionState> {
    const result = await createResignationAction(previousState, formData)

    if (result.ok) {
      toast.success("退職を申請しました")
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
      <h2 className="text-lg font-medium">退職を申請</h2>

      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="resignation-date">退職希望日</FieldLabel>

            <Input id="resignation-date" name="resignation_date" type="date" required />
          </Field>

          <Field>
            <FieldLabel htmlFor="resignation-last">最終出社日</FieldLabel>

            <Input id="resignation-last" name="last_working_date" type="date" />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="resignation-reason">理由</FieldLabel>

          <Input id="resignation-reason" name="reason" placeholder="任意" />
        </Field>
      </FieldGroup>

      <FieldDescription>最終出社日と理由は任意です。法的判定は行わず記録のみです</FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "申請中..." : "申請する"}
        </Button>
      </div>
    </form>
  )
}
