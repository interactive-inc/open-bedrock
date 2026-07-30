"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createFamilyCareLeaveAction } from "@/app/(app)/my/family-care-leaves/actions"
import type { FamilyCareLeaveActionState } from "@/app/(app)/my/family-care-leaves/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: FamilyCareLeaveActionState = { ok: false, error: null }

/**
 * 休業申出フォーム。native form + Server Action を useActionState で呼び、結果を sonner で通知する。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 */
export function FamilyCareLeaveCreateForm() {
  const router = useRouter()

  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: FamilyCareLeaveActionState,
    formData: FormData,
  ): Promise<FamilyCareLeaveActionState> {
    const result = await createFamilyCareLeaveAction(previousState, formData)

    if (result.ok) {
      toast.success("休業を申し出ました")

      router.push("/my/family-care-leaves")
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
      <h2 className="text-lg font-medium">休業を申し出る</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="leave-kind">種別</FieldLabel>

          <NativeSelect id="leave-kind" name="leave_kind" className="w-full" required>
            <NativeSelectOption value="maternity">産休</NativeSelectOption>

            <NativeSelectOption value="childcare">育休</NativeSelectOption>

            <NativeSelectOption value="family_care">介護休業</NativeSelectOption>

            <NativeSelectOption value="other">その他（療養等）</NativeSelectOption>
          </NativeSelect>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="leave-start">開始日</FieldLabel>

            <Input id="leave-start" name="start_date" type="date" required />
          </Field>

          <Field>
            <FieldLabel htmlFor="leave-end">終了予定日</FieldLabel>

            <Input id="leave-end" name="end_date" type="date" required />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="leave-note">備考</FieldLabel>

          <Input
            id="leave-note"
            name="note"
            maxLength={FORM_CONSTRAINTS.familyCareLeave.noteMax}
            placeholder="任意"
          />
        </Field>
      </FieldGroup>

      <FieldDescription>備考は任意です。給付金額の計算や判定は行わず記録のみです</FieldDescription>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "申請中..." : "申し出る"}
        </Button>
      </div>
    </form>
  )
}
