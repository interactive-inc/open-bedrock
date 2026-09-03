"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import {
  assignGovernanceOrgRoleAction,
  type GovernanceActionState,
} from "@/app/(app)/governance/governance-documents/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: GovernanceActionState = { ok: false, error: null }

type Role = {
  code: string
  name: string
  assignmentMode: "manual" | "department_manager"
}

async function reduceAssignment(
  state: GovernanceActionState,
  formData: FormData,
): Promise<GovernanceActionState> {
  const result = await assignGovernanceOrgRoleAction(state, formData)
  if (result.ok) toast.success("組織ロールを割り当てました")
  else if (result.error !== null) toast.error(result.error)
  return result
}

export function OrgRoleAssignmentForm(props: { roles: ReadonlyArray<Role>; today: string }) {
  const [, action, pending] = useActionState(reduceAssignment, initialState)
  const manualRoles = props.roles.filter((role) => role.assignmentMode === "manual")

  return (
    <form action={action} className="rounded-xl bg-card border p-4">
      <FieldGroup className="gap-4 md:grid md:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="org-role-code">組織ロール</FieldLabel>
          <select
            id="org-role-code"
            name="org_role_code"
            aria-label="組織ロール"
            required
            defaultValue=""
            className="h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="" disabled>
              選択してください
            </option>
            {manualRoles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}（{role.code}）
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="employee-code">従業員コード</FieldLabel>
          <Input
            id="employee-code"
            name="employee_code"
            required
            maxLength={100}
            placeholder="E001"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="department-code">部署コード（部門単位の場合）</FieldLabel>
          <Input id="department-code" name="department_code" maxLength={100} />
        </Field>
        <Field>
          <FieldLabel htmlFor="starts-on">開始日</FieldLabel>
          <Input id="starts-on" name="starts_on" type="date" required defaultValue={props.today} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ends-on">終了日（任意）</FieldLabel>
          <Input id="ends-on" name="ends_on" type="date" />
        </Field>
        <Field>
          <FieldLabel htmlFor="source-document-code">根拠文書ID（任意）</FieldLabel>
          <Input
            id="source-document-code"
            name="source_document_code"
            maxLength={120}
            placeholder="policy.example"
          />
          <FieldDescription>任命の根拠となる規程IDを記録できます。</FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={pending} className="mt-4">
        割り当てる
      </Button>
    </form>
  )
}
