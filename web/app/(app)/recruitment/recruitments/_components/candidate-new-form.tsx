"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { createCandidateAction } from "@/app/(app)/recruitment/recruitments/actions"
import type { RecruitmentActionState } from "@/app/(app)/recruitment/recruitments/actions"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: RecruitmentActionState = { ok: false, error: null }

type Props = {
  positionId: number
}

/**
 * この募集に応募者を追加するフォーム。名前・連絡先・流入元・備考を入力する。
 * 追加後は applied ステージで始まる。成功時は一覧を再取得する。
 */
export function CandidateNewForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: RecruitmentActionState,
    formData: FormData,
  ): Promise<RecruitmentActionState> {
    const result = await createCandidateAction(previousState, formData)

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
        <input type="hidden" name="position_id" value={props.positionId} />

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="candidate_name">応募者名</FieldLabel>

            <Input id="candidate_name" name="name" />
          </Field>

          <Field>
            <FieldLabel htmlFor="candidate_email">メール（任意）</FieldLabel>

            <Input id="candidate_email" name="email" type="email" />
          </Field>

          <Field>
            <FieldLabel htmlFor="candidate_source">流入元（任意）</FieldLabel>

            <Input id="candidate_source" name="source" />
          </Field>

          <Field>
            <FieldLabel htmlFor="candidate_note">備考</FieldLabel>

            <Textarea id="candidate_note" name="note" rows={2} />
          </Field>
        </FieldGroup>

        {state.error === null ? null : <FieldError>{state.error}</FieldError>}

        <Button type="submit" disabled={pending}>
          {pending ? "追加中..." : "応募者を追加"}
        </Button>
      </form>
    </Card>
  )
}
