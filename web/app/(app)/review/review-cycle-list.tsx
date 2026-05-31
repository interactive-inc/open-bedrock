"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { ReviewFormState } from "@/app/(app)/review/actions"
import { closeReviewCycleAction, openReviewCycleAction } from "@/app/(app)/review/actions"
import { toCycleStatusLabel } from "@/app/(app)/review/to-cycle-status-label"
import { toCycleStatusVariant } from "@/app/(app)/review/to-cycle-status-variant"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { ReviewCycleResponse } from "@/lib/api/types/review-types"

type Props = {
  cycles: Array<ReviewCycleResponse>
  canAdminister: boolean
}

const initialState: ReviewFormState = { ok: false, error: null }

// 評価サイクル一覧。各サイクルを Card で並べる。特権ロールには draft→open / open→closed の操作を出す。
// 開閉の結果は action の戻り値を見て toast で通知する（useEffect は使わない）。
export function ReviewCycleList(props: Props) {
  const openAction = useActionState(openReviewCycleAction, initialState)

  const openState = openAction[0]

  const openDispatch = openAction[1]

  const isOpening = openAction[2]

  const closeAction = useActionState(closeReviewCycleAction, initialState)

  const closeState = closeAction[0]

  const closeDispatch = closeAction[1]

  const isClosing = closeAction[2]

  if (openState.ok) {
    toast.success("サイクルを開始しました")
  } else if (openState.error !== null) {
    toast.error(openState.error)
  }

  if (closeState.ok) {
    toast.success("サイクルを終了しました")
  } else if (closeState.error !== null) {
    toast.error(closeState.error)
  }

  if (props.cycles.length === 0) {
    return <p className="text-sm text-muted-foreground">評価サイクルはありません</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {props.cycles.map((cycle) => (
        <Card key={cycle.id}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{cycle.title}</span>

                <Badge variant={toCycleStatusVariant(cycle.status)}>
                  {toCycleStatusLabel(cycle.status)}
                </Badge>
              </div>

              <span className="text-xs text-muted-foreground">{cycle.period}</span>
            </div>
          </CardHeader>

          <CardContent className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">締切: {cycle.due_date ?? "-"}</span>

            {props.canAdminister ? (
              <div className="flex gap-2">
                {cycle.status === "draft" ? (
                  <form action={openDispatch}>
                    <input type="hidden" name="cycle_id" value={cycle.id} />

                    <Button type="submit" variant="secondary" size="sm" disabled={isOpening}>
                      開始する
                    </Button>
                  </form>
                ) : null}

                {cycle.status === "open" ? (
                  <form action={closeDispatch}>
                    <input type="hidden" name="cycle_id" value={cycle.id} />

                    <Button type="submit" variant="outline" size="sm" disabled={isClosing}>
                      終了する
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
