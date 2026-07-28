import { RewardRedeemForm } from "@/app/(app)/organization/thanks/_components/reward-redeem-form"
import { FetchError } from "@/components/fetch-error"
import { getThanksRewards } from "@/lib/api/get-thanks-rewards"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

/** 交換カタログをサーバ側 fetch して並べる非同期 RSC。各景品に交換申請ボタンを添える。 */
export async function ThanksRewards() {
  const rewards = await getThanksRewards()

  if (rewards instanceof Error) {
    return <FetchError message="カタログの取得に失敗しました" />
  }

  if (rewards.length === 0) {
    return <EmptyState title="交換できる景品がまだありません" />
  }

  return (
    <div className="flex flex-col gap-3">
      {rewards.map((reward) => (
        <Card key={reward.id} size="sm">
          <CardContent className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{reward.name}</span>

                {reward.is_active ? null : <Badge variant="secondary">無効</Badge>}
              </div>

              <p className="text-sm text-muted-foreground">
                {reward.point_cost} pt
                {reward.stock === null ? "" : ` ・ 在庫 ${reward.stock}`}
              </p>
            </div>

            <RewardRedeemForm
              rewardId={reward.id ?? 0}
              disabled={reward.is_active === false || (reward.stock !== null && reward.stock <= 0)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
