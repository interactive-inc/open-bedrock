"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createDepartmentDefinitionAction } from "@/app/(app)/organization/departments/definitions/actions"
import type { DepartmentDefinitionActionState } from "@/app/(app)/organization/departments/definitions/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

const initialState: DepartmentDefinitionActionState = { ok: false, error: null }

/** 部署マスタ作成フォーム。name のみ必須。同名の重複は api がエラーを返す。 */
export function DepartmentDefinitionCreateForm() {
  async function reduce(
    previousState: DepartmentDefinitionActionState,
    formData: FormData,
  ): Promise<DepartmentDefinitionActionState> {
    const result = await createDepartmentDefinitionAction(previousState, formData)

    if (result.ok) {
      toast.success("部署マスタを作成しました")
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
          <FieldLabel htmlFor="department-definition-name">部署名</FieldLabel>

          <Input
            id="department-definition-name"
            name="name"
            placeholder="研究開発部"
            maxLength={FORM_CONSTRAINTS.departmentDefinition.nameMax}
            required
          />

          <FieldDescription>
            部署の正式名称を登録します。組織図への配置は部署ノードの作成で行います。
          </FieldDescription>
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "部署マスタを作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
