"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createEmployeeAction } from "@/app/(app)/employees/actions"
import type { EmployeeCreateFormState } from "@/app/(app)/employees/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: EmployeeCreateFormState = { ok: false, error: null }

const selectClassName =
  "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

// 従業員登録フォーム。コード・氏名・メール・初期パスワード・ロール・在籍状況を native form で送る。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function EmployeeCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: EmployeeCreateFormState,
    formData: FormData,
  ): Promise<EmployeeCreateFormState> {
    const result = await createEmployeeAction(previousState, formData)

    if (result.ok) {
      toast.success("従業員を登録しました")

      router.push("/employees")
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
          <FieldLabel htmlFor="employee-code">従業員コード</FieldLabel>

          <Input
            id="employee-code"
            name="code"
            placeholder="E100"
            maxLength={FORM_CONSTRAINTS.employee.codeMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-name">氏名</FieldLabel>

          <Input
            id="employee-name"
            name="name"
            placeholder="Sam Rivers"
            maxLength={FORM_CONSTRAINTS.employee.nameMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-email">メール</FieldLabel>

          <Input
            id="employee-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            maxLength={FORM_CONSTRAINTS.employee.emailMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-password">初期パスワード</FieldLabel>

          <Input
            id="employee-password"
            name="password"
            type="password"
            minLength={FORM_CONSTRAINTS.employee.passwordMin}
            maxLength={FORM_CONSTRAINTS.employee.passwordMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-role">ロール</FieldLabel>

          <select id="employee-role" name="role" defaultValue="member" className={selectClassName}>
            <option value="member">member</option>
            <option value="manager">manager</option>
            <option value="hr">hr</option>
            <option value="admin">admin</option>
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-dept-id">部署 ID（任意）</FieldLabel>

          <Input id="employee-dept-id" name="dept_id" type="number" />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-dept-name">部署名（任意）</FieldLabel>

          <Input
            id="employee-dept-name"
            name="dept_name"
            placeholder="Engineering"
            maxLength={FORM_CONSTRAINTS.employee.deptNameMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-position">役職（任意）</FieldLabel>

          <Input
            id="employee-position"
            name="position"
            placeholder="Engineer"
            maxLength={FORM_CONSTRAINTS.employee.positionMax}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="employee-status">在籍状況</FieldLabel>

          <select
            id="employee-status"
            name="status"
            defaultValue="active"
            className={selectClassName}
          >
            <option value="active">在籍</option>
            <option value="leave">休職</option>
            <option value="retired">退職</option>
          </select>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "従業員を登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
