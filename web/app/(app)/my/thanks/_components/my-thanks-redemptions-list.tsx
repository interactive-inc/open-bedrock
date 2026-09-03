import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMyRedemptions } from "@/lib/api/get-my-redemptions"
import { getThanksRewards } from "@/lib/api/get-thanks-rewards"
import { formatDateTime } from "@/lib/format-date-time"
import { statusLabel } from "@/lib/status-label"

/** GET /thanks-redemptions/me を取得し、自分の交換履歴・申請状況の一覧テーブルを描画する非同期 RSC。 */
export async function MyThanksRedemptionsList() {
  const [redemptions, rewards] = await Promise.all([getMyRedemptions(), getThanksRewards()])

  if (redemptions instanceof Error) {
    return <FetchError message="交換履歴の取得に失敗しました" />
  }

  if (redemptions.data.length === 0) {
    return <EmptyState title="まだ景品と交換していません" />
  }

  const rewardNameById = new Map(
    (rewards instanceof Error ? [] : rewards).map((reward) => [reward.id, reward.name]),
  )

  return (
    <div className="overflow-x-auto">
      <Table aria-label="交換履歴">
        <TableHeader>
          <TableRow>
            <TableHead>景品</TableHead>
            <TableHead>消費ポイント</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>申請日</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {redemptions.data.map((redemption) => (
            <TableRow key={redemption.id}>
              <TableCell>
                {rewardNameById.get(redemption.reward_id) ?? `景品 #${redemption.reward_id}`}
              </TableCell>

              <TableCell>{redemption.point_cost} pt</TableCell>

              <TableCell>{statusLabel(redemption.status)}</TableCell>

              <TableCell>{formatDateTime(redemption.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
