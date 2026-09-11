"use client"

import { useRouter } from "next/navigation"
import { startTransition, useActionState, useRef, useState } from "react"
import { toast } from "sonner"
import { createLicenseAction } from "@/app/(app)/software-license/licenses/actions"
import type { LicenseActionState } from "@/app/(app)/software-license/licenses/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  commandId: string
  employees: ReadonlyArray<{ id: string; code: string | null; name: string }>
}

const initialState: LicenseActionState = { ok: false, error: null }

/** ライセンス登録フォーム。名称必須、その他は任意。成功時は /licenses へ戻る。 */
export function LicenseCreateForm(props: Props) {
  const router = useRouter()
  const fields = useState<Record<string, string>>({})
  function updateField(name: string, value: string) {
    fields[1]({ ...fields[0], [name]: value })
    commandId.current = null
  }
  const commandId = useRef<string | null>(props.commandId)

  async function reduce(
    previousState: LicenseActionState,
    formData: FormData,
  ): Promise<LicenseActionState> {
    commandId.current ??= crypto.randomUUID()
    formData.set("command_id", commandId.current)
    const result = await createLicenseAction(previousState, formData)

    if (result.ok) {
      toast.success("ライセンスを登録しました")

      router.push("/software-license/licenses")
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
    <form
      onChange={() => {
        commandId.current = null
      }}
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        startTransition(() => formAction(form))
      }}
    >
      <fieldset disabled={isPending}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="license-name">名称</FieldLabel>

            <Input
              id="license-name"
              name="name"
              value={fields[0].name ?? ""}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Project Tracker"
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="license-plan">プラン名（任意）</FieldLabel>

            <Input
              id="license-plan"
              name="plan_name"
              value={fields[0].plan_name ?? ""}
              onChange={(event) => updateField("plan_name", event.target.value)}
              maxLength={300}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="license-vendor">ベンダ（任意）</FieldLabel>

            <Input
              id="license-vendor"
              name="vendor"
              value={fields[0].vendor ?? ""}
              onChange={(event) => updateField("vendor", event.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="license-category">区分（任意）</FieldLabel>

            <NativeSelect
              id="license-category"
              name="category"
              value={fields[0].category ?? ""}
              onChange={(event) => updateField("category", event.target.value)}
              className="w-full"
            >
              <NativeSelectOption value="">未設定</NativeSelectOption>
              <NativeSelectOption value="saas">SaaS</NativeSelectOption>
              <NativeSelectOption value="software">ソフトウェア</NativeSelectOption>
              <NativeSelectOption value="other">その他</NativeSelectOption>
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="license-seats">座席数（任意）</FieldLabel>

            <Input
              id="license-seats"
              name="seats"
              value={fields[0].seats ?? ""}
              onChange={(event) => updateField("seats", event.target.value)}
              type="number"
              min="0"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="license-renewal-deadline">更新期限（任意）</FieldLabel>

            <Input
              id="license-renewal-deadline"
              name="renewal_deadline"
              value={fields[0].renewal_deadline ?? ""}
              onChange={(event) => updateField("renewal_deadline", event.target.value)}
              type="date"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="license-owner">管理担当の職員（任意）</FieldLabel>

            <NativeSelect
              id="license-owner"
              name="owner_employee_id"
              value={fields[0].owner_employee_id ?? ""}
              onChange={(event) => updateField("owner_employee_id", event.target.value)}
            >
              <NativeSelectOption value="">未設定</NativeSelectOption>
              {props.employees.map((employee) => (
                <NativeSelectOption key={employee.id} value={employee.id}>
                  {employee.name}
                  {employee.code === null ? "" : ` (${employee.code})`}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field>
            <FieldLabel htmlFor="license-note">備考（任意）</FieldLabel>

            <Input
              id="license-note"
              name="note"
              value={fields[0].note ?? ""}
              onChange={(event) => updateField("note", event.target.value)}
            />
          </Field>

          {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

          <Field orientation="horizontal">
            <Button type="submit" disabled={isPending}>
              {isPending ? "登録中..." : "ライセンスを登録"}
            </Button>
          </Field>
        </FieldGroup>
      </fieldset>
    </form>
  )
}
