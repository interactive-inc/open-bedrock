"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createGoalEvaluationAction } from "@/app/(app)/performance-review/goals/actions"
import type { GoalActionState } from "@/app/(app)/performance-review/goals/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"
import { evaluationKindLabel } from "@/app/(app)/performance-review/goals/[goal]/_lib/evaluation-kind-label"
import type { GoalEvaluationKind } from "@/lib/api/types/goal-types"

type Props = {
  goalId: number
  allowedKinds: ReadonlyArray<GoalEvaluationKind>
}

const initialState: GoalActionState = { ok: false, error: null }

/**
 * 評価登録フォーム。useActionState で createGoalEvaluationAction を呼び結果を sonner で通知する。
 * kind は native form と相性の良い select、score は number、comment は textarea。
 * reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
 */
export function GoalEvaluationForm(props: Props) {
  /** useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。 */
  async function reduce(
    previousState: GoalActionState,
    formData: FormData,
  ): Promise<GoalActionState> {
    const result = await createGoalEvaluationAction(previousState, formData)

    if (result.ok) {
      toast.success("評価を登録しました")
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
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl bg-card border p-4">
      <h2 className="text-lg font-medium">評価を登録</h2>

      <input type="hidden" name="goalId" value={props.goalId} />

      <FieldGroup>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="evaluation-kind">種別</FieldLabel>

            <NativeSelect
              id="evaluation-kind"
              name="kind"
              defaultValue={props.allowedKinds.at(0)}
              className="w-full"
            >
              {props.allowedKinds.map((kind) => (
                <NativeSelectOption key={kind} value={kind}>
                  {evaluationKindLabel(kind)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="evaluation-score">スコア</FieldLabel>

            <Input
              id="evaluation-score"
              name="score"
              type="number"
              inputMode="numeric"
              min={FORM_CONSTRAINTS.goal.scoreMin}
              max={FORM_CONSTRAINTS.goal.scoreMax}
              step={1}
              placeholder="任意"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="evaluation-comment">コメント</FieldLabel>

          <Textarea
            id="evaluation-comment"
            name="comment"
            maxLength={FORM_CONSTRAINTS.goal.commentMax}
            placeholder="任意"
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "登録する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
