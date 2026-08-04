"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createOrgDepartmentAction } from "@/app/(app)/organization/departments/actions"
import type { OrgDepartmentActionState } from "@/app/(app)/organization/departments/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DepartmentDefinitionResponse } from "@/lib/api/types/department-definition-types"

const initialState: OrgDepartmentActionState = { ok: false, error: null }

type Props = {
  departmentDefinitions: ReadonlyArray<DepartmentDefinitionResponse>
}

/** 部署ノード作成フォーム。コード・部署マスタ・表示順は必須、親と責任者は任意。成功時は一覧へ遷移する。 */
export function OrgDepartmentCreateForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: OrgDepartmentActionState,
    formData: FormData,
  ): Promise<OrgDepartmentActionState> {
    const result = await createOrgDepartmentAction(previousState, formData)

    if (result.ok) {
      toast.success("部署を作成しました")

      router.push("/organization/departments")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const [state, formAction, pending] = useActionState(reduce, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="create_code">部署コード</FieldLabel>

          <Input id="create_code" name="code" placeholder="D010" />
        </Field>

        <Field>
          <FieldLabel htmlFor="create_department_id">部署マスタ</FieldLabel>

          <Select name="department_id">
            <SelectTrigger id="create_department_id">
              <SelectValue placeholder="部署マスタを選択" />
            </SelectTrigger>

            <SelectContent>
              {props.departmentDefinitions.map((department) => (
                <SelectItem key={department.id} value={String(department.id)}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <FieldDescription>
            該当する部署が無い場合は
            <Link href="/organization/departments/definitions" className="underline">
              部署マスタの管理
            </Link>
            から作成します。
          </FieldDescription>
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
        {pending ? "作成中…" : "部署を作成"}
      </Button>
    </form>
  )
}
