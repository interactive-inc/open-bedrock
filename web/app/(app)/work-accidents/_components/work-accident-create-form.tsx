"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createWorkAccidentAction } from "@/app/(app)/work-accidents/actions"
import type { WorkAccidentActionState } from "@/app/(app)/work-accidents/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const initialState: WorkAccidentActionState = { ok: false, error: null }

// 労災・事故の発生記録を登録するフォーム。native form + Server Action を useActionState で呼ぶ。
// 対象者が特定できない事故もあるため従業員 ID は任意。
export function WorkAccidentCreateForm() {
  async function reduce(
    previousState: WorkAccidentActionState,
    formData: FormData,
  ): Promise<WorkAccidentActionState> {
    const result = await createWorkAccidentAction(previousState, formData)

    if (result.ok) {
      toast.success("労災・事故記録を登録しました")
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
      <h2 className="text-lg font-medium">発生記録を登録</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="accident-occurred">発生日</FieldLabel>

          <Input id="accident-occurred" name="occurred_on" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="accident-summary">概要</FieldLabel>

          <Input id="accident-summary" name="summary" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="accident-employee">従業員 ID</FieldLabel>

          <Input
            id="accident-employee"
            name="employee_id"
            placeholder="任意（対象者不特定なら空欄）"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="accident-location">場所</FieldLabel>

          <Input id="accident-location" name="location" placeholder="任意" />
        </Field>

        <Field>
          <FieldLabel htmlFor="accident-severity">程度</FieldLabel>

          <Select name="severity">
            <SelectTrigger id="accident-severity">
              <SelectValue placeholder="任意" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="minor">軽微</SelectItem>
              <SelectItem value="serious">重大</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <FieldDescription>労災認定の判定は行いません。起きた事実のみを記録します。</FieldDescription>

      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "登録中..." : "登録する"}
        </Button>
      </div>
    </form>
  )
}
