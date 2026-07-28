"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createGradeAction } from "@/app/(app)/organization/grades/actions"
import type { GradeActionState } from "@/app/(app)/organization/grades/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: GradeActionState = { ok: false, error: null }

/** 等級作成フォーム。code/name/rank 必須、説明は任意。成功時は /grades へ戻す。 */
export function GradeCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: GradeActionState,
    formData: FormData,
  ): Promise<GradeActionState> {
    const result = await createGradeAction(previousState, formData)

    if (result.ok) {
      toast.success("等級を作成しました")

      router.push("/organization/grades")
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
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="grade-code">コード</FieldLabel>

          <Input
            id="grade-code"
            name="code"
            placeholder="G1"
            maxLength={FORM_CONSTRAINTS.grade.codeMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="grade-name">名称</FieldLabel>

          <Input
            id="grade-name"
            name="name"
            placeholder="メンバー"
            maxLength={FORM_CONSTRAINTS.grade.nameMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="grade-rank">ランク</FieldLabel>

          <Input
            id="grade-rank"
            name="rank"
            type="number"
            inputMode="numeric"
            min={FORM_CONSTRAINTS.grade.rankMin}
            max={FORM_CONSTRAINTS.grade.rankMax}
            step={1}
            placeholder="1"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="grade-description">説明（任意）</FieldLabel>

          <Textarea
            id="grade-description"
            name="description"
            maxLength={FORM_CONSTRAINTS.grade.descriptionMax}
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "等級を作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
