"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createBusinessTripAction } from "@/app/(app)/my/business-trips/actions"
import type { BusinessTripActionState } from "@/app/(app)/my/business-trips/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: BusinessTripActionState = { ok: false, error: null }

// 出張申請フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function BusinessTripCreateForm() {
  const router = useRouter()

  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: BusinessTripActionState,
    formData: FormData,
  ): Promise<BusinessTripActionState> {
    const result = await createBusinessTripAction(previousState, formData)

    if (result.ok) {
      toast.success("出張を申請しました")

      router.push("/my/business-trips")
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
      <h2 className="text-lg font-medium">出張を申請</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="trip-destination">行き先</FieldLabel>

          <Input
            id="trip-destination"
            name="destination"
            maxLength={FORM_CONSTRAINTS.businessTrip.destinationMax}
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="trip-start">開始日</FieldLabel>

            <Input id="trip-start" name="start_date" type="date" required />
          </Field>

          <Field>
            <FieldLabel htmlFor="trip-end">終了日</FieldLabel>

            <Input id="trip-end" name="end_date" type="date" required />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="trip-purpose">目的</FieldLabel>

          <Input
            id="trip-purpose"
            name="purpose"
            maxLength={FORM_CONSTRAINTS.businessTrip.purposeMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="trip-cost">概算費用</FieldLabel>

          <Input
            id="trip-cost"
            name="estimated_cost"
            type="number"
            min={FORM_CONSTRAINTS.businessTrip.estimatedCostMin}
            step={1}
            placeholder="任意"
          />
        </Field>
      </FieldGroup>

      <FieldDescription>概算費用は任意です。金額の計算や判定は行わず記録のみです</FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "申請中..." : "申請する"}
        </Button>
      </div>
    </form>
  )
}
