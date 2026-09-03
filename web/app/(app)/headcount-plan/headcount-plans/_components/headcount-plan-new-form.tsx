"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { createHeadcountPlanAction } from "@/app/(app)/headcount-plan/headcount-plans/actions"
import type { HeadcountPlanActionState } from "@/app/(app)/headcount-plan/headcount-plans/actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: HeadcountPlanActionState = { ok: false, error: null }

/**
 * 人員計画を登録するフォーム。年度・部署コード・計画人数・備考を入力する。
 * 部署コードを空にすると全社の計画になる。成功時は一覧を再取得する。
 */
export function HeadcountPlanNewForm() {
  const router = useRouter()

  async function reduce(
    previousState: HeadcountPlanActionState,
    formData: FormData,
  ): Promise<HeadcountPlanActionState> {
    const result = await createHeadcountPlanAction(previousState, formData)

    if (result.ok) {
      router.refresh()
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <Card className="gap-0">
      <form action={formAction} className="flex flex-col gap-4 p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="headcount_fiscal_year">年度</FieldLabel>

            <Input id="headcount_fiscal_year" name="fiscal_year" type="number" />
          </Field>

          <Field>
            <FieldLabel htmlFor="headcount_department_code">部署コード（空欄で全社）</FieldLabel>

            <Input id="headcount_department_code" name="department_code" />
          </Field>

          <Field>
            <FieldLabel htmlFor="headcount_planned_count">計画人数</FieldLabel>

            <Input id="headcount_planned_count" name="planned_count" type="number" min={0} />
          </Field>

          <Field>
            <FieldLabel htmlFor="headcount_note">備考</FieldLabel>

            <Textarea id="headcount_note" name="note" rows={2} />
          </Field>
        </FieldGroup>

        {state.error === null ? null : <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending}>
          {pending ? "登録中..." : "人員計画を登録"}
        </Button>
      </form>
    </Card>
  )
}
