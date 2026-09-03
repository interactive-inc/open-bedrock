"use client"

import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { deleteCommendationAction } from "@/app/(app)/commendation/commendations/actions"
import type { CommendationActionState } from "@/app/(app)/commendation/commendations/actions"
import { Button } from "@/components/ui/button"

const initialState: CommendationActionState = { ok: false, error: null }

type Props = {
  id: number
}

/**
 * 表彰の記録を1件削除するボタン。commendation:manage を持つ利用者にのみ表示する。
 * 成功時は一覧を再取得する。
 */
export function CommendationDeleteButton(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: CommendationActionState,
    formData: FormData,
  ): Promise<CommendationActionState> {
    const result = await deleteCommendationAction(previousState, formData)

    if (result.ok) {
      router.refresh()
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const formAction = action[1]

  const pending = action[2]

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={props.id} />

      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "削除中..." : "削除"}
      </Button>
    </form>
  )
}
