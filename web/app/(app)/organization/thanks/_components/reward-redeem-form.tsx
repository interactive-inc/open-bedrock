"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import { requestRedemptionAction } from "@/app/(app)/organization/thanks/actions"
import type { ThanksActionState } from "@/app/(app)/organization/thanks/actions"
import { Button } from "@/components/ui/button"

type Props = {
  rewardId: number
  disabled: boolean
}

const initialState: ThanksActionState = { ok: false, error: null }

// 1つの景品に対する交換申請ボタン。useActionState で requestRedemptionAction を呼ぶ。
// reducer 内で結果に応じて toast() する（useEffect は使わない）。
export function RewardRedeemForm(props: Props) {
  async function reduce(
    previousState: ThanksActionState,
    formData: FormData,
  ): Promise<ThanksActionState> {
    const result = await requestRedemptionAction(previousState, formData)

    if (result.ok) {
      toast.success("交換を申請しました")
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
      <input type="hidden" name="reward_id" value={props.rewardId} />

      <Button type="submit" size="sm" variant="outline" disabled={props.disabled || isPending}>
        {isPending ? "申請中..." : "交換を申請"}
      </Button>
    </form>
  )
}
