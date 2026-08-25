"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createGoalAction } from "@/app/(app)/organization/goals/actions"
import type { GoalActionState } from "@/app/(app)/organization/goals/actions"
import type { GoalPeriodOption } from "@/app/(app)/organization/goals/_lib/to-goal-period-options"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  defaultPeriod: string | null
  periodOptions: GoalPeriodOption[]
}

const initialState: GoalActionState = { ok: false, error: null }

/**
 * 目標作成フォーム。useActionState で createGoalAction を呼び、結果を sonner で通知する。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 */
export function GoalCreateForm(props: Props) {
  const router = useRouter()

  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: GoalActionState,
    formData: FormData,
  ): Promise<GoalActionState> {
    const result = await createGoalAction(previousState, formData)

    if (result.ok) {
      toast.success("目標を作成しました")

      router.push("/organization/goals")
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
      <h2 className="text-lg font-medium">目標を作成</h2>

      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="create-period">期間</FieldLabel>

            <Select name="period" defaultValue={props.defaultPeriod ?? undefined} required>
              <SelectTrigger id="create-period" className="w-full">
                <SelectValue placeholder="期間を選択" />
              </SelectTrigger>

              <SelectContent>
                {props.periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="create-title">タイトル</FieldLabel>

            <Input
              id="create-title"
              name="title"
              maxLength={FORM_CONSTRAINTS.goal.titleMax}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="create-kpi">KPI</FieldLabel>

            <Input
              id="create-kpi"
              name="kpi"
              maxLength={FORM_CONSTRAINTS.goal.kpiMax}
              placeholder="任意"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="create-weight">ウェイト</FieldLabel>

            <Input
              id="create-weight"
              name="weight"
              type="number"
              inputMode="numeric"
              min={FORM_CONSTRAINTS.goal.weightMin}
              max={FORM_CONSTRAINTS.goal.weightMax}
              step={1}
              defaultValue="10"
            />
          </Field>
        </div>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "作成する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
