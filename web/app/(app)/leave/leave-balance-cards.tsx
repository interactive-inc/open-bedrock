import { Card } from "@/components/ui/card"
import { LeaveTypeLabel } from "@/components/leave-type-label"
import { getLeaveBalanceMe } from "@/lib/api/get-leave-balance-me"

// /leave/balance/me を認証付きで取得し、休暇種別ごとの残日数カードを描画する非同期 RSC。
export async function LeaveBalanceCards() {
  const balances = await getLeaveBalanceMe()

  if (balances instanceof Error) {
    return <p className="text-sm text-destructive">残日数の取得に失敗しました</p>
  }

  if (balances.length === 0) {
    return <p className="text-sm text-muted-foreground">付与された休暇はまだありません</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((balance) => (
        <Card key={`${balance.fiscal_year}-${balance.leave_type}`} className="p-0 gap-0">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                <LeaveTypeLabel leaveType={balance.leave_type} />
              </span>

              <span className="text-xs text-muted-foreground">{balance.fiscal_year} 年度</span>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold">{balance.remaining_days}</span>

              <span className="text-sm text-muted-foreground">日 残</span>
            </div>

            <span className="text-xs text-muted-foreground">
              付与 {balance.granted_days} 日 / 取得 {balance.used_days} 日
            </span>
          </div>
        </Card>
      ))}
    </div>
  )
}
