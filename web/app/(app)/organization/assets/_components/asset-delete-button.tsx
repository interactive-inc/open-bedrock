"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { deleteAssetAction } from "@/app/(app)/organization/assets/actions"
import type { AssetDeleteFormState } from "@/app/(app)/organization/assets/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

type Props = {
  // 削除対象の資産コード。hidden フィールドへ埋め込む。
  code: string
}

const initialState: AssetDeleteFormState = { ok: false, error: null }

// 物品削除ボタン。成功・失敗の通知は action の結果を見て toast() で出す。成功時は一覧へ遷移する。
export function AssetDeleteButton(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: AssetDeleteFormState,
    formData: FormData,
  ): Promise<AssetDeleteFormState> {
    const result = await deleteAssetAction(previousState, formData)

    if (result.ok) {
      toast.success("物品を削除しました")

      router.push("/organization/assets")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const isPending = action[2]

  return (
    <ConfirmActionDialog
      action={formAction}
      triggerLabel="削除"
      title="この物品を削除しますか？"
      description="物品の台帳情報は元に戻せません。貸与中の物品は削除できません。"
      confirmLabel="物品を削除"
      pending={isPending}
    >
      <input type="hidden" name="code" value={props.code} />
    </ConfirmActionDialog>
  )
}
