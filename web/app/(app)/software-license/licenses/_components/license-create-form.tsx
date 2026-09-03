"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createLicenseAction } from "@/app/(app)/software-license/licenses/actions"
import type { LicenseActionState } from "@/app/(app)/software-license/licenses/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: LicenseActionState = { ok: false, error: null }

/** ライセンス登録フォーム。名称必須、その他は任意。成功時は /licenses へ戻る。 */
export function LicenseCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: LicenseActionState,
    formData: FormData,
  ): Promise<LicenseActionState> {
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
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="license-name">名称</FieldLabel>

          <Input id="license-name" name="name" placeholder="Project Tracker" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="license-vendor">ベンダ（任意）</FieldLabel>

          <Input id="license-vendor" name="vendor" />
        </Field>

        <Field>
          <FieldLabel htmlFor="license-category">区分（任意）</FieldLabel>

          <select
            id="license-category"
            name="category"
            defaultValue=""
            className="h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="">未設定</option>
            <option value="saas">SaaS</option>
            <option value="software">ソフトウェア</option>
            <option value="other">その他</option>
          </select>
        </Field>

        <Field>
          <FieldLabel htmlFor="license-seats">座席数（任意）</FieldLabel>

          <Input id="license-seats" name="seats" type="number" min="0" />
        </Field>

        <Field>
          <FieldLabel htmlFor="license-renewal-deadline">更新期限（任意）</FieldLabel>

          <Input id="license-renewal-deadline" name="renewal_deadline" type="date" />
        </Field>

        <Field>
          <FieldLabel htmlFor="license-owner">管理担当の従業員 ID（任意）</FieldLabel>

          <Input id="license-owner" name="owner_employee_id" type="number" min="1" />
        </Field>

        <Field>
          <FieldLabel htmlFor="license-note">備考（任意）</FieldLabel>

          <Input id="license-note" name="note" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "ライセンスを登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
