"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { checkStocktakeItemAction } from "@/app/(app)/stocktakes/actions"
import type { StocktakeCheckFormState } from "@/app/(app)/stocktakes/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Props = {
  id: string
  assetCode: string
  // すでに確認済みか。確認済みなら再確認扱いのラベルにする。
  checked: boolean
}

const initialState: StocktakeCheckFormState = { ok: false, error: null }

// 現物確認フォーム。所在メモ（任意）を添えて確認を記録する。実施中のセッションでのみ表示する想定。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function StocktakeCheckForm(props: Props) {
  async function reduce(
    previousState: StocktakeCheckFormState,
    formData: FormData,
  ): Promise<StocktakeCheckFormState> {
    const result = await checkStocktakeItemAction(previousState, formData)

    if (result.ok) {
      toast.success("確認を記録しました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={props.id} />

      <input type="hidden" name="asset_code" value={props.assetCode} />

      <Input
        name="location_note"
        placeholder="所在メモ（任意）"
        aria-label="所在メモ"
        className="w-40"
      />

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "記録中..." : props.checked ? "再確認" : "確認"}
      </Button>
    </form>
  )
}
