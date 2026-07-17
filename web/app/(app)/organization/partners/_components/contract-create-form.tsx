"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createContractAction } from "@/app/(app)/organization/partners/actions"
import type { ContractCreateFormState } from "@/app/(app)/organization/partners/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Props = {
  partnerId: number
  partnerCode: string
}

const initialState: ContractCreateFormState = { ok: false, error: null }

// 契約記録の追加フォーム。partner_id と code は hidden。契約日は必須、期間・更新期限は任意。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function ContractCreateForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: ContractCreateFormState,
    formData: FormData,
  ): Promise<ContractCreateFormState> {
    const result = await createContractAction(previousState, formData)

    if (result.ok) {
      toast.success("契約記録を追加しました")

      router.refresh()
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
      <input type="hidden" name="partner_id" value={props.partnerId} />

      <input type="hidden" name="code" value={props.partnerCode} />

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="contract-title">契約名</FieldLabel>

          <Input id="contract-title" name="title" placeholder="基本取引契約" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="contract-date">契約日</FieldLabel>

          <Input id="contract-date" name="contract_date" type="date" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="contract-starts-on">開始日（任意）</FieldLabel>

          <Input id="contract-starts-on" name="starts_on" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="contract-ends-on">終了日（任意）</FieldLabel>

          <Input id="contract-ends-on" name="ends_on" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="contract-renewal-deadline">更新期限（任意）</FieldLabel>

          <Input id="contract-renewal-deadline" name="renewal_deadline" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="contract-note">備考（任意）</FieldLabel>

          <Input id="contract-note" name="note" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "追加中..." : "契約記録を追加"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
