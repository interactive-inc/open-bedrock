import { getThanksBalance } from "@/lib/api/get-thanks-balance"
import { getThanksBudget } from "@/lib/api/get-thanks-budget"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"

/** 当月の贈与原資の残量と受領残高をサーバ側 fetch して並べる非同期 RSC。 */
export async function ThanksSummary() {
  const budget = await getThanksBudget()

  const balance = await getThanksBalance()

  const remainingBudget = budget instanceof Error ? null : budget.remaining_points

  const grantedPoints = budget instanceof Error ? null : budget.granted_points

  const balancePoints = balance instanceof Error ? null : balance.balance_points

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card size="sm">
        <CardHeader>
          <CardDescription>今月の贈与原資（残量 / 付与）</CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-2xl font-semibold">
            {remainingBudget ?? "-"}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {grantedPoints ?? "-"} pt
            </span>
          </p>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardDescription>受領残高（交換可能）</CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-2xl font-semibold">
            {balancePoints ?? "-"}
            <span className="ml-1 text-base font-normal text-muted-foreground">pt</span>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
