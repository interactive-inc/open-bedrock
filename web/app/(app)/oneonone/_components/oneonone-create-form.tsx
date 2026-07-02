"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createOneOnOneAction } from "@/app/(app)/oneonone/actions"
import type { OneOnOneActionState } from "@/app/(app)/oneonone/actions"
import { EmployeeSelect } from "@/components/employee-select"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: OneOnOneActionState = { ok: false, error: null }

type Props = {
  employees: ReadonlyArray<{ code: string; name: string }>
}

// 1on1 記録の作成フォーム。useActionState で createOneOnOneAction を呼び、結果を sonner で通知する。
// reducer 内で Server Action を 1 回だけ実行し、その結果で toast() する（useEffect は使わない）。
export function OneOnOneCreateForm(props: Props) {
  const router = useRouter()

  // useActionState の reducer。Server Action を実行し結果をそのまま次の state にする。
  async function reduce(
    previousState: OneOnOneActionState,
    formData: FormData,
  ): Promise<OneOnOneActionState> {
    const result = await createOneOnOneAction(previousState, formData)

    if (result.ok) {
      toast.success("1on1 を記録しました")

      router.push("/oneonone")
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
      <h2 className="text-lg font-medium">1on1 を記録</h2>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="create-member-code">メンバー</FieldLabel>

          <EmployeeSelect
            id="create-member-code"
            name="member_employee_code"
            employees={props.employees}
            required
          />

          <FieldDescription>上長は自分が設定されます。</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="create-topics">トピック</FieldLabel>

          <Textarea
            id="create-topics"
            name="topics"
            placeholder="話したテーマ（任意）"
            rows={3}
            maxLength={FORM_CONSTRAINTS.oneOnOne.textMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="create-manager-note">上長メモ</FieldLabel>

          <Textarea
            id="create-manager-note"
            name="manager_note"
            placeholder="所感・気づき（任意）"
            rows={3}
            maxLength={FORM_CONSTRAINTS.oneOnOne.textMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="create-next-action">ネクストアクション</FieldLabel>

          <Textarea
            id="create-next-action"
            name="next_action"
            placeholder="次回までの行動（任意）"
            rows={2}
            maxLength={FORM_CONSTRAINTS.oneOnOne.textMax}
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "記録中..." : "記録する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
