"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createAssetAction } from "@/app/(app)/asset/assets/actions"
import type { AssetCreateFormState } from "@/app/(app)/asset/assets/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

const initialState: AssetCreateFormState = { ok: false, error: null }

/**
 * 物品登録フォーム。コード・名称・種別・任意のシリアル/購入日を native form で送る。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function AssetCreateForm() {
  const router = useRouter()

  async function reduce(
    previousState: AssetCreateFormState,
    formData: FormData,
  ): Promise<AssetCreateFormState> {
    const result = await createAssetAction(previousState, formData)

    if (result.ok) {
      toast.success("物品を登録しました")

      router.push("/asset/assets")
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
          <FieldLabel htmlFor="asset-code">資産コード</FieldLabel>

          <Input id="asset-code" name="code" placeholder="PC-0001" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="asset-name">名称</FieldLabel>

          <Input id="asset-name" name="name" placeholder="MacBook Pro 14" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="asset-kind">種別</FieldLabel>

          <NativeSelect id="asset-kind" name="kind" defaultValue="pc" className="w-full">
            <NativeSelectOption value="pc">PC</NativeSelectOption>
            <NativeSelectOption value="monitor">モニター</NativeSelectOption>
            <NativeSelectOption value="furniture">什器</NativeSelectOption>
            <NativeSelectOption value="other">その他</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field>
          <FieldLabel htmlFor="asset-serial">シリアル（任意）</FieldLabel>

          <Input id="asset-serial" name="serial" placeholder="C02XXXXX" />
        </Field>

        <Field>
          <FieldLabel htmlFor="asset-purchased-on">購入日（任意）</FieldLabel>

          <Input id="asset-purchased-on" name="purchased_on" type="date" />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "登録中..." : "物品を登録"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
