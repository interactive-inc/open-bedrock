"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { createAssetAction } from "@/app/(app)/assets/actions"
import type { AssetCreateFormState } from "@/app/(app)/assets/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const initialState: AssetCreateFormState = { ok: false, error: null }

// 物品登録フォーム。コード・名称・種別・任意のシリアル/購入日を native form で送る。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function AssetCreateForm() {
  async function reduce(
    previousState: AssetCreateFormState,
    formData: FormData,
  ): Promise<AssetCreateFormState> {
    const result = await createAssetAction(previousState, formData)

    if (result.ok) {
      toast.success("物品を登録しました")
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

          <select
            id="asset-kind"
            name="kind"
            defaultValue="pc"
            className="h-8 w-full min-w-0 rounded-2xl border border-transparent bg-input/50 px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <option value="pc">PC</option>
            <option value="monitor">モニター</option>
            <option value="furniture">什器</option>
            <option value="other">その他</option>
          </select>
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
