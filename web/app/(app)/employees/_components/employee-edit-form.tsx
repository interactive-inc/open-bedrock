"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updateEmployeeAction } from "@/app/(app)/employees/actions"
import type { EmployeeUpdateFormState } from "@/app/(app)/employees/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  // 編集対象の従業員。hidden の code と各入力の初期値に使う。
  code: string
  name: string
  email: string
  role: string
  deptName: string | null
  position: string | null
  status: string
}

const initialState: EmployeeUpdateFormState = { ok: false, error: null }

const selectClassName =
  "h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"

// 従業員編集フォームを Dialog で開く。氏名・メール・ロール・部署名・役職・在籍状況を変更して送信する。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function EmployeeEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: EmployeeUpdateFormState,
    formData: FormData,
  ): Promise<EmployeeUpdateFormState> {
    const result = await updateEmployeeAction(previousState, formData)

    if (result.ok) {
      toast.success("従業員を更新しました")

      setOpen(false)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>従業員を編集</DialogTitle>

          <DialogDescription>
            氏名・メール・ロール・部署・役職・在籍状況を変更します。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-employee-name">氏名</FieldLabel>

              <Input
                id="edit-employee-name"
                name="name"
                defaultValue={props.name}
                maxLength={FORM_CONSTRAINTS.employee.nameMax}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-employee-email">メール</FieldLabel>

              <Input
                id="edit-employee-email"
                name="email"
                type="email"
                defaultValue={props.email}
                maxLength={FORM_CONSTRAINTS.employee.emailMax}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-employee-role">ロール</FieldLabel>

              <Input id="edit-employee-role" name="role" defaultValue={props.role} required />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-employee-dept-name">部署名（任意）</FieldLabel>

              <Input
                id="edit-employee-dept-name"
                name="dept_name"
                defaultValue={props.deptName ?? ""}
                maxLength={FORM_CONSTRAINTS.employee.deptNameMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-employee-position">役職（任意）</FieldLabel>

              <Input
                id="edit-employee-position"
                name="position"
                defaultValue={props.position ?? ""}
                maxLength={FORM_CONSTRAINTS.employee.positionMax}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-employee-status">在籍状況</FieldLabel>

              <select
                id="edit-employee-status"
                name="status"
                defaultValue={props.status}
                className={selectClassName}
              >
                <option value="active">在籍</option>
                <option value="leave">休職</option>
                <option value="retired">退職</option>
              </select>
            </Field>

            {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "更新中..." : "変更を保存"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
