"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { returnAssetAction } from "@/app/(app)/assets/actions"
import type { AssetReturnFormState } from "@/app/(app)/assets/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 返却対象の資産コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: AssetReturnFormState = { ok: false, error: null }

// 物品返却フォーム。貸与中の物品にだけ表示する想定。ボタン 1 つで返却する。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function AssetReturnForm(props: Props) {
  const action = useActionState(returnAssetAction, initialState)

  const state = action[0]

  const dispatch = action[1]

  const isPending = action[2]

  // form action に渡すラッパ。Server Action の結果をその場で toast する。
  async function handleAction(formData: FormData): Promise<void> {
    const result = await returnAssetAction(state, formData)

    if (result.ok) {
      toast.success("返却しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    dispatch(formData)
  }

  return (
    <form action={handleAction} className="flex flex-col gap-2">
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "返却中..." : "返却"}
      </Button>

      {state.error !== null ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  )
}
