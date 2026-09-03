"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { createPositionAction } from "@/app/(app)/recruitment/recruitments/actions"
import type { RecruitmentActionState } from "@/app/(app)/recruitment/recruitments/actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: RecruitmentActionState = { ok: false, error: null }

/**
 * 募集ポジションを作成するフォーム。タイトル・部署コード・備考を入力する。
 * 成功時は一覧を再取得する。
 */
export function PositionNewForm() {
  const router = useRouter()

  async function reduce(
    previousState: RecruitmentActionState,
    formData: FormData,
  ): Promise<RecruitmentActionState> {
    const result = await createPositionAction(previousState, formData)

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
    <Card className="gap-0 p-0">
      <form action={formAction} className="flex flex-col gap-4 p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="position_title">募集タイトル</FieldLabel>

            <Input id="position_title" name="title" />
          </Field>

          <Field>
            <FieldLabel htmlFor="position_department_code">部署コード（任意）</FieldLabel>

            <Input id="position_department_code" name="department_code" />
          </Field>

          <Field>
            <FieldLabel htmlFor="position_note">備考</FieldLabel>

            <Textarea id="position_note" name="note" rows={2} />
          </Field>
        </FieldGroup>

        {state.error === null ? null : <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "作成中..." : "募集を作成"}
        </Button>
      </form>
    </Card>
  )
}
