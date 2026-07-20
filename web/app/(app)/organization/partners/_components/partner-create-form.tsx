"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createPartnerAction } from "@/app/(app)/organization/partners/actions"
import type { PartnerCreateFormState } from "@/app/(app)/organization/partners/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: PartnerCreateFormState = { ok: false, error: null }

/**
 * 取引先登録フォーム。コード・名称・任意の分類/法人番号/備考を native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function PartnerCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: PartnerCreateFormState,
    formData: FormData,
  ): Promise<PartnerCreateFormState> {
    const result = await createPartnerAction(previousState, formData)

    if (result.ok) {
      toast.success("取引先を登録しました")

      router.push("/organization/partners")
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
          <FieldLabel htmlFor="partner-code">取引先コード</FieldLabel>

          <Input id="partner-code" name="code" placeholder="P0001" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="partner-name">名称</FieldLabel>

          <Input id="partner-name" name="name" placeholder="Acme Supplies" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="partner-category">分類（任意）</FieldLabel>

          <select
            id="partner-category"
            name="category"
            defaultValue=""
            className="h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">未設定</option>
            <option value="customer">顧客</option>
            <option value="supplier">仕入先</option>
            <option value="other">その他</option>
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="partner-corporate-number">法人番号（任意）</FieldLabel>

          <Input
            id="partner-corporate-number"
            name="corporate_number"
            placeholder="1234567890123"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="partner-note">備考（任意）</FieldLabel>

          <Input id="partner-note" name="note" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "取引先を登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
