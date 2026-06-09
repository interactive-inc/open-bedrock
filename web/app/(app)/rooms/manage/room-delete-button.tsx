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
  async function reduce(
    previousState: RoomDeleteFormState,
    formData: FormData,
  ): Promise<RoomDeleteFormState> {
    const result = await deleteRoomAction(previousState, formData)

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
      <input type="hidden" name="id" value={props.id} />

      <Button type="submit" variant="destructive" size="sm" disabled={isPending}>
        削除
      </Button>
    </form>
  )
}
