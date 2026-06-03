"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { deleteRoomAction } from "@/app/(app)/rooms/manage/actions"
import type { RoomDeleteFormState } from "@/app/(app)/rooms/manage/actions"
import { Button } from "@/components/ui/button"

type Props = {
  // 削除対象の会議室 id。hidden フィールドへ埋め込む。
  id: number
}

const initialState: RoomDeleteFormState = { ok: false, error: null }

// 会議室削除ボタン。成功時は Server Action 側で /rooms/manage へ遷移する。
export function RoomDeleteButton(props: Props) {
  const action = useActionState(deleteRoomAction, initialState)

  const dispatch = action[1]

  const isPending = action[2]

  // form action に渡すラッパ。失敗時のみ toast する（成功時は遷移するため戻らない）。
  async function handleAction(formData: FormData): Promise<void> {
    const result = await deleteRoomAction(initialState, formData)

    if (result.error !== null) {
      toast.error(result.error)
    }

    dispatch(formData)
  }

  return (
    <form action={handleAction}>
      <input type="hidden" name="id" value={props.id} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
