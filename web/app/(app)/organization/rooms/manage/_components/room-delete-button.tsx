"use client"

import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { deleteRoomAction } from "@/app/(app)/organization/rooms/manage/actions"
import type { RoomDeleteFormState } from "@/app/(app)/organization/rooms/manage/actions"
import { ConfirmActionDialog } from "@/components/confirm-action-dialog"

type Props = {
  // 削除対象の会議室 id。hidden フィールドへ埋め込む。
  id: number
}

const initialState: RoomDeleteFormState = { ok: false, error: null }

// 会議室削除ボタン。成功・失敗の通知は action の結果を見て toast() で出す。成功時は一覧へ遷移する。
export function RoomDeleteButton(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: RoomDeleteFormState,
    formData: FormData,
  ): Promise<RoomDeleteFormState> {
    const result = await deleteRoomAction(previousState, formData)

    if (result.ok) {
      toast.success("会議室を削除しました")

      router.push("/organization/rooms/manage")
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
      title="この会議室を削除しますか？"
      description="会議室マスタから削除され、今後は予約できなくなります。"
      confirmLabel="会議室を削除"
      pending={isPending}
    >
      <input type="hidden" name="id" value={props.id} />
    </ConfirmActionDialog>
  )
}
