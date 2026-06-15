"use client"

import { useActionState, useState } from "react"
import { toast } from "sonner"
import {
  createOrgDepartmentAction,
  deleteOrgDepartmentAction,
  updateOrgDepartmentAction,
} from "@/app/(app)/org/departments/actions"
import type { OrgDepartmentActionState } from "@/app/(app)/org/departments/actions"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OrgDepartmentResponse } from "@/lib/api/types/org-types"

type Props = {
  departments: ReadonlyArray<OrgDepartmentResponse>
}

// 部署ノードの管理表。新規作成フォームと、各行の変更（Dialog）・削除ボタンを置く。
// 作成・変更・削除はいずれも権限が必要で、権限不足時は api がエラーを返す。
export function OrgDepartmentManagerList(props: Props) {
  return (
    <div className="flex flex-col gap-6">
      <CreateDepartmentForm />

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>コード</TableHead>

              <TableHead>マスタ ID</TableHead>

              <TableHead>親</TableHead>

              <TableHead>責任者</TableHead>

              <TableHead>表示順</TableHead>

              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {props.departments.map((department) => (
              <TableRow key={department.code}>
                <TableCell className="font-medium">{department.code}</TableCell>

                <TableCell>{department.department_id}</TableCell>

                <TableCell>{department.parent_code ?? "-"}</TableCell>

                <TableCell>{department.manager_employee_code ?? "-"}</TableCell>

                <TableCell>{department.order}</TableCell>

                <TableCell>
                  <div className="flex justify-end gap-2">
                    <UpdateDepartmentDialog department={department} />

                    <DeleteDepartmentButton code={department.code} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// 部署ノード作成フォーム。コード・マスタ ID・表示順は必須、親と責任者は任意。
function CreateDepartmentForm() {
  async function reduce(
    previousState: OrgDepartmentActionState,
    formData: FormData,
  ): Promise<OrgDepartmentActionState> {
    const result = await createOrgDepartmentAction(previousState, formData)

    if (result.ok) {
      toast.success("部署を作成しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="create_code">部署コード</FieldLabel>

          <Input id="create_code" name="code" placeholder="D010" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_department_id">部署マスタ ID</FieldLabel>

          <Input id="create_department_id" name="department_id" type="number" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_parent_code">親コード</FieldLabel>

          <Input id="create_parent_code" name="parent_code" placeholder="任意" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_manager">責任者の従業員コード</FieldLabel>

          <Input id="create_manager" name="manager_employee_code" placeholder="任意" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_order">表示順</FieldLabel>

          <Input id="create_order" name="order" type="number" />
        </Field>
      </FieldGroup>

      {state.error === null ? null : <FieldError>{state.error}</FieldError>}

      <Button type="submit" disabled={pending}>
        部署を作成
      </Button>
    </form>
  )
}

// 部署ノード変更フォームを Dialog で開く。親・責任者・表示順を編集して送信する。
function UpdateDepartmentDialog(props: { department: OrgDepartmentResponse }) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: OrgDepartmentActionState,
    formData: FormData,
  ): Promise<OrgDepartmentActionState> {
    const result = await updateOrgDepartmentAction(previousState, formData)

    if (result.ok) {
      toast.success("部署を更新しました")

      setOpen(false)
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, {
    ok: false,
    error: null,
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>部署を変更</DialogTitle>

          <DialogDescription>親・責任者・表示順を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.department.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="update_parent_code">親コード</FieldLabel>

              <Input
                id="update_parent_code"
                name="parent_code"
                defaultValue={props.department.parent_code ?? ""}
                placeholder="任意"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_manager">責任者の従業員コード</FieldLabel>

              <Input
                id="update_manager"
                name="manager_employee_code"
                defaultValue={props.department.manager_employee_code ?? ""}
                placeholder="任意"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="update_order">表示順</FieldLabel>

              <Input
                id="update_order"
                name="order"
                type="number"
                defaultValue={props.department.order}
              />
            </Field>
          </FieldGroup>

          {state.error === null ? null : <FieldError>{state.error}</FieldError>}

          <Button type="submit" disabled={pending}>
            変更を保存
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 部署ノード削除ボタン。Server Action を呼び、成功時は一覧が revalidate される。
function DeleteDepartmentButton(props: { code: string }) {
  const [state, formAction, pending] = useActionState(deleteOrgDepartmentAction, {
    ok: false,
    error: null,
  })

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        削除
      </Button>

      {state.error === null ? null : <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  )
}
