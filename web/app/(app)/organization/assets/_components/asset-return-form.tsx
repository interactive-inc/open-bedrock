"use client"

import { FieldError } from "@/components/ui/field"
import { useActionState } from "react"
import { toast } from "sonner"
import { returnAssetAction } from "@/app/(app)/organization/assets/actions"
import type { AssetReturnFormState } from "@/app/(app)/organization/assets/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 返却対象の資産コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: AssetReturnFormState = { ok: false, error: null }

// 物品返却フォーム。貸与中の物品にだけ表示する想定。ボタン 1 つで返却する。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function AssetReturnForm(props: Props) {
  async function reduce(
    previousState: AssetReturnFormState,
    formData: FormData,
  ): Promise<AssetReturnFormState> {
    const result = await returnAssetAction(previousState, formData)

    if (result.ok) {
      toast.success("返却しました")
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
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "返却中..." : "返却"}
      </Button>

      {state.error !== null ? <FieldError>{state.error}</FieldError> : null}
    </form>
  )
}
