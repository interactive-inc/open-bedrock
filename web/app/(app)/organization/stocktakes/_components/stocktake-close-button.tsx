"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { closeStocktakeAction } from "@/app/(app)/organization/stocktakes/actions"
import type { StocktakeCloseFormState } from "@/app/(app)/organization/stocktakes/actions"
import { Button } from "@/components/ui/button"

type Props = {
  id: string
}

const initialState: StocktakeCloseFormState = { ok: false, error: null }

// 棚卸し締めボタン。ボタン 1 つでセッションを締める。実施中のセッションでのみ表示する想定。
// 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
export function StocktakeCloseButton(props: Props) {
  async function reduce(
    previousState: StocktakeCloseFormState,
    formData: FormData,
  ): Promise<StocktakeCloseFormState> {
    const result = await closeStocktakeAction(previousState, formData)

    if (result.ok) {
      toast.success("棚卸しを締めました")
    } else if (result.error !== null) {
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

      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? "締め中..." : "棚卸しを締める"}
      </Button>
    </form>
  )
}
