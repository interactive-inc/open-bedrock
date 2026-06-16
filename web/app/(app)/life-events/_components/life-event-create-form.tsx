"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createLifeEventAction } from "@/app/(app)/life-events/actions"
import type { LifeEventActionState } from "@/app/(app)/life-events/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: LifeEventActionState = { ok: false, error: null }

// ライフイベント届出フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function LifeEventCreateForm() {
  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: LifeEventActionState,
    formData: FormData,
  ): Promise<LifeEventActionState> {
    const result = await createLifeEventAction(previousState, formData)

    if (result.ok) {
      toast.success("ライフイベントを届け出ました")
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
      <h2 className="text-lg font-medium">ライフイベントを届け出る</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="event-type">種別</FieldLabel>

          <Input
            id="event-type"
            name="event_type"
            maxLength={FORM_CONSTRAINTS.lifeEvent.eventTypeMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="event-date">発生日</FieldLabel>

          <Input id="event-date" name="event_date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="event-detail">詳細</FieldLabel>

          <Input
            id="event-detail"
            name="detail"
            maxLength={FORM_CONSTRAINTS.lifeEvent.detailMax}
            placeholder="任意"
          />
        </Field>
      </FieldGroup>

      <FieldDescription>
        詳細は任意です。法的判定や給付金の計算は行わず記録のみです
      </FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "届出中..." : "届け出る"}
        </Button>
      </div>
    </form>
  )
}
