import { getThanksBalance } from "@/lib/api/get-thanks-balance"
import { getThanksBudget } from "@/lib/api/get-thanks-budget"
import { Card } from "@/components/ui/card"

// 当月の贈与原資の残量と受領残高をサーバ側 fetch して並べる非同期 RSC。
export async function ThanksSummary() {
  const budget = await getThanksBudget()

  const balance = await getThanksBalance()

  const remainingBudget = budget instanceof Error ? null : budget.remaining_points

  const grantedPoints = budget instanceof Error ? null : budget.granted_points

  const balancePoints = balance instanceof Error ? null : balance.balance_points

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="gap-2 p-4">
        <p className="text-sm text-muted-foreground">今月の贈与原資（残量 / 付与）</p>

        <p className="text-2xl font-semibold">
          {remainingBudget ?? "-"}
          <span className="ml-1 text-base font-normal text-muted-foreground">
            / {grantedPoints ?? "-"} pt
          </span>
        </p>
      </Card>

      <Card className="gap-2 p-4">
        <p className="text-sm text-muted-foreground">受領残高（交換可能）</p>

        <p className="text-2xl font-semibold">
          {balancePoints ?? "-"}
          <span className="ml-1 text-base font-normal text-muted-foreground">pt</span>
        </p>
      </Card>
    </div>
  )
}
