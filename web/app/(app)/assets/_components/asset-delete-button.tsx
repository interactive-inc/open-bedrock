"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteAssetAction } from "@/app/(app)/assets/actions"
import type { AssetDeleteFormState } from "@/app/(app)/assets/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 削除対象の資産コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: AssetDeleteFormState = { ok: false, error: null }

// 物品削除ボタン。成功時は Server Action 側で /assets へ遷移する。貸与中は失敗を toast する。
export function AssetDeleteButton(props: Props) {
  async function reduce(
    previousState: AssetDeleteFormState,
    formData: FormData,
  ): Promise<AssetDeleteFormState> {
    const result = await deleteAssetAction(previousState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
