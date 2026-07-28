"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createRentalReservationAction } from "@/app/(app)/my/rentals/actions"
import type { RentalReservationActionState } from "@/app/(app)/my/rentals/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: RentalReservationActionState = { ok: false, error: null }

/**
 * レンタル予約申請フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 */
export function RentalReservationCreateForm() {
  const router = useRouter()

  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: RentalReservationActionState,
    formData: FormData,
  ): Promise<RentalReservationActionState> {
    const result = await createRentalReservationAction(previousState, formData)

    if (result.ok) {
      toast.success("レンタルを申請しました")

      router.push("/my/rentals")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-4">
      <h2 className="text-lg font-medium">レンタルを申請</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="rental-create-item">品名</FieldLabel>

          <Input id="rental-create-item" name="item_name" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="rental-create-start">開始日</FieldLabel>

          <Input id="rental-create-start" name="start_date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="rental-create-end">終了日</FieldLabel>

          <Input id="rental-create-end" name="end_date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="rental-create-purpose">用途</FieldLabel>

          <Input id="rental-create-purpose" name="purpose" placeholder="任意" />
        </Field>
      </FieldGroup>

      <FieldDescription>申請後は一覧から変更・取消できます</FieldDescription>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "申請中..." : "申請する"}
        </Button>
      </div>
    </form>
  )
}
