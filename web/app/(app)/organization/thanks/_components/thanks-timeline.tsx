"use client"

import { Loader2 } from "lucide-react"
import { useState, useTransition } from "react"
import { loadMoreThanksAction } from "@/app/(app)/organization/thanks/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/format-datetime"
import type { ThanksResponse } from "@/lib/api/types/thanks-types"

type Props = {
  initialItems: Array<ThanksResponse>
  total: number
  pageSize: number
}

/**
 * 感謝タイムラインのクライアントコンポーネント。
 * 初回データは RSC（ThanksList）で取得済み。追加読み込みは Server Action 経由で行う。
 */
export function ThanksTimeline(props: Props) {
  const [items, setItems] = useState(props.initialItems)

  const [isPending, startTransition] = useTransition()

  const hasMore = items.length < props.total

  function handleLoadMore() {
    startTransition(async () => {
      const result = await loadMoreThanksAction(items.length)

      if (result !== null && result.data.length > 0) {
        setItems((previous) => [...previous, ...result.data])
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((thanks) => (
        <Card key={thanks.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>{thanks.sender_name}</span>
              <span className="text-sm font-normal text-muted-foreground">→</span>
              <span>{thanks.recipient_name}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {formatDateTime(thanks.created_at)}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="text-sm">
            <p className="whitespace-pre-wrap">{thanks.message}</p>
          </CardContent>
        </Card>
      ))}

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" disabled={isPending} onClick={handleLoadMore}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                読み込み中...
              </>
            ) : (
              `もっと読み込む（残り ${props.total - items.length} 件）`
            )}
          </Button>
        </div>
      ) : items.length > props.pageSize ? (
        <p className="text-center text-xs text-muted-foreground">全 {props.total} 件を表示中</p>
      ) : null}
    </div>
  )
}
