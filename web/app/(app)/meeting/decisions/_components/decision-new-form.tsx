"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { createDecisionAction } from "@/app/(app)/meeting/decisions/actions"
import type { DecisionActionState } from "@/app/(app)/meeting/decisions/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const initialState: DecisionActionState = { ok: false, error: null }

/**
 * 意思決定記録を新規作成するフォーム。ADR らしく背景・決定・帰結を分けて入力する。
 * 成功時は /decisions に遷移する。
 */
export function DecisionNewForm() {
  const router = useRouter()

  async function reduce(
    previousState: DecisionActionState,
    formData: FormData,
  ): Promise<DecisionActionState> {
    const result = await createDecisionAction(previousState, formData)

    if (result.ok) {
      router.push("/meeting/decisions")
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="decision_title">タイトル</FieldLabel>

          <Input id="decision_title" name="title" />
        </Field>

        <Field>
          <FieldLabel htmlFor="decision_decided_on">決定日</FieldLabel>

          <Input id="decision_decided_on" name="decided_on" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="decision_context">背景（Context）</FieldLabel>

          <Textarea id="decision_context" name="context" rows={5} />
        </Field>

        <Field>
          <FieldLabel htmlFor="decision_decision">決定内容（Decision）</FieldLabel>

          <Textarea id="decision_decision" name="decision" rows={5} />
        </Field>

        <Field>
          <FieldLabel htmlFor="decision_consequences">帰結（Consequences）</FieldLabel>

          <Textarea id="decision_consequences" name="consequences" rows={5} />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      <Button type="submit" disabled={pending}>
        {pending ? "作成中..." : "作成"}
      </Button>
    </form>
  )
}
