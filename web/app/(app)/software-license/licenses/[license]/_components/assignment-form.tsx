"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { assignLicenseAction } from "@/app/(app)/software-license/licenses/[license]/actions"
import type { LicenseActionState } from "@/app/(app)/software-license/licenses/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  licenseId: number
  employees: ReadonlyArray<{ id: string; code: string | null; name: string }>
}
const initial: LicenseActionState = { ok: false, error: null }

/** 応答不明時は同じIDで再送し、入力を変更したときだけ別の利用開始記録とする。 */
export function AssignmentForm(props: Props) {
  const commandId = useRef<string | null>(null)
  const employee = useState("")
  const account = useState("")
  const reason = useState("")
  const router = useRouter()
  const action = useActionState(async (previous: LicenseActionState, form: FormData) => {
    commandId.current ??= crypto.randomUUID()
    form.set("id", commandId.current)
    const recorded = await assignLicenseAction(previous, form)
    if (recorded.ok) {
      toast.success("利用開始を記録しました")
      router.push(`/software-license/licenses/${props.licenseId}`)
    }
    return recorded
  }, initial)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        startTransition(() => action[1](form))
      }}
      onChange={() => {
        commandId.current = null
      }}
    >
      <input type="hidden" name="license_id" value={props.licenseId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="assignment-employee">職員</FieldLabel>
          <NativeSelect
            id="assignment-employee"
            name="employee_id"
            value={employee[0]}
            onChange={(event) => employee[1](event.target.value)}
            required
            disabled={action[2]}
          >
            <NativeSelectOption value="">選択してください</NativeSelectOption>
            {props.employees.map((employee) => (
              <NativeSelectOption key={employee.id} value={employee.id}>
                {employee.name}
                {employee.code === null ? "" : ` (${employee.code})`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="assignment-account">外部アカウントの識別名（任意）</FieldLabel>
          <Input
            id="assignment-account"
            name="account_reference"
            value={account[0]}
            onChange={(event) => account[1](event.target.value)}
            maxLength={300}
            disabled={action[2]}
          />
          <FieldDescription>
            利用者を照合するための識別名です。パスワードやAPIキーは入力しないでください。
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="assignment-reason">利用開始を記録する理由</FieldLabel>
          <Textarea
            id="assignment-reason"
            name="reason"
            value={reason[0]}
            onChange={(event) => reason[1](event.target.value)}
            required
            maxLength={1000}
            disabled={action[2]}
          />
        </Field>
        {action[0].error === null ? null : <FieldError>{action[0].error}</FieldError>}
        <Field>
          <Button type="submit" disabled={action[2] || props.employees.length === 0}>
            {action[2] ? "記録中..." : "利用開始を記録する"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
