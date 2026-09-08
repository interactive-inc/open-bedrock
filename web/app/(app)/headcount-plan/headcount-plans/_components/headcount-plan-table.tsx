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
import { getHeadcountPlanList } from "@/lib/api/get-headcount-plan-list"
import { Button } from "@/components/ui/button"

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
                  <GapLabel gap={gap} />
                </TableCell>

                <TableCell>{plan.note ?? ""}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** 実在籍数と計画人数の差分表示。過不足の向きを色で示す。 */
function GapLabel(props: { gap: number }) {
  if (props.gap === 0) {
    return (
      <Button type="button" variant="secondary" size="sm">
        ±0
      </Button>
    )
  }

  if (props.gap > 0) {
    return (
      <Button type="button" variant="secondary" size="sm">
        +{props.gap}（超過）
      </Button>
    )
  }

  return (
    <Button type="button" variant="destructive" size="sm">
      {props.gap}（不足）
    </Button>
  )
}
