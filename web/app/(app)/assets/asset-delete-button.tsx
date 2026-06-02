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
  const action = useActionState(deleteAssetAction, initialState)

  const dispatch = action[1]

  const isPending = action[2]

  // form action に渡すラッパ。失敗時のみ toast する（成功時は遷移するため戻らない）。
  async function handleAction(formData: FormData): Promise<void> {
    const result = await deleteAssetAction(initialState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    }

    dispatch(formData)
  }

  return (
    <form action={handleAction}>
      <input type="hidden" name="code" value={props.code} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
