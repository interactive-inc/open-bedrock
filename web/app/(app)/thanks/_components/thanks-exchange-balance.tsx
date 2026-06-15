import { getThanksBalance } from "@/lib/api/get-thanks-balance"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"

// 交換セクション付近に受領残高（交換可能ポイント）を再掲し、自分のポイントで交換できることを案内する非同期 RSC。
export async function ThanksExchangeBalance() {
  const balance = await getThanksBalance()

  const balancePoints = balance instanceof Error ? null : balance.balance_points

  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>
          受領残高（交換可能）であなたのポイントを景品と交換できます
        </CardDescription>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-semibold">
          {balancePoints ?? "-"}
          <span className="ml-1 text-base font-normal text-muted-foreground">pt</span>
        </p>
      </CardContent>
    </Card>
  )
}
