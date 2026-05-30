"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { lendAssetAction } from "@/app/(app)/assets/actions"
import type { AssetLendFormState } from "@/app/(app)/assets/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Props = {
  // 貸与対象の資産コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: AssetLendFormState = { ok: false, error: null }

// 物品貸与フォーム。従業員コードを入力して貸与する。在庫の物品にだけ表示する想定。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function AssetLendForm(props: Props) {
  const action = useActionState(lendAssetAction, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  // form action に渡すラッパ。Server Action の結果をその場で toast する。
  async function handleAction(formData: FormData): Promise<void> {
    const result = await lendAssetAction(state, formData)

    if (result.ok) {
      toast.success("貸与しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    dispatch(formData)
  }

  return (
    <form action={handleAction} className="flex flex-col gap-2">
      <input type="hidden" name="code" value={props.code} />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          name="employee_code"
          placeholder="従業員コード"
          className="w-48"
          aria-invalid={state.error !== null}
          required
        />

        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "貸与中..." : "貸与"}
        </Button>
      </div>

      {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  )
}
