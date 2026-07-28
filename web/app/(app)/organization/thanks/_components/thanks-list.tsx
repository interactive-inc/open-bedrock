import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { getThanksList } from "@/lib/api/get-thanks-list"
import { ThanksTimeline } from "@/app/(app)/organization/thanks/_components/thanks-timeline"

const INITIAL_LIMIT = 20

/**
 * 感謝のタイムラインをサーバ側 fetch してカード描画する非同期 RSC。
 * 初回は最新 20 件を取得し、残りがあれば ThanksTimeline に「もっと読み込む」を委譲する。
 */
export async function ThanksList() {
  const result = await getThanksList({ limit: INITIAL_LIMIT, offset: 0 })

  if (result instanceof Error) {
    return <FetchError message="感謝の取得に失敗しました" />
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        title="まだ感謝がありません"
        description="右上の「感謝を送る」から同僚に感謝を伝えましょう。"
      />
    )
  }

  return <ThanksTimeline initialItems={result.data} total={result.total} pageSize={INITIAL_LIMIT} />
}
