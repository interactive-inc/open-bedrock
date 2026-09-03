import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getHeadcountPlanList } from "@/lib/api/get-headcount-plan-list"

type Props = {
  fiscalYear?: number
}

/** GET /headcount-plans を認証付きで取得し、計画人数と実在籍数(active)を並べた比較テーブルを描画する RSC。 */
export async function HeadcountPlanTable(props: Props) {
  const plans = await getHeadcountPlanList({ fiscalYear: props.fiscalYear })

  if (plans instanceof Error) {
    return <FetchError message="人員計画の取得に失敗しました" />
  }

  if (plans.length === 0) {
    return (
      <EmptyState
        title="人員計画はまだありません"
        description="年度・部署ごとの計画人数を登録すると、実在籍数との比較を確認できます。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>年度</TableHead>

            <TableHead>部署</TableHead>

            <TableHead className="text-right">計画人数</TableHead>

            <TableHead className="text-right">実在籍(active)</TableHead>

            <TableHead className="text-right">差分</TableHead>

            <TableHead>備考</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {plans.map((plan) => {
            const gap = plan.actual_count - plan.planned_count

            return (
              <TableRow key={plan.id}>
                <TableCell>{plan.fiscal_year}</TableCell>

                <TableCell>{plan.department_code ?? "全社"}</TableCell>

                <TableCell className="text-right tabular-nums">{plan.planned_count}</TableCell>

                <TableCell className="text-right tabular-nums">{plan.actual_count}</TableCell>

                <TableCell className="text-right">
                  <GapBadge gap={gap} />
                </TableCell>

                <TableCell className="text-muted-foreground">{plan.note ?? ""}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** 実在籍数と計画人数の差分バッジ。過不足の向きを色で示す。 */
function GapBadge(props: { gap: number }) {
  if (props.gap === 0) {
    return <Badge variant="secondary">±0</Badge>
  }

  if (props.gap > 0) {
    return <Badge variant="outline">+{props.gap}（超過）</Badge>
  }

  return <Badge variant="destructive">{props.gap}（不足）</Badge>
}
