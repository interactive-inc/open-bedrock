import { FetchError } from "@/components/fetch-error"
import { statusLabel } from "@/lib/status-label"
import Link from "next/link"
import { getGoalList } from "@/lib/api/get-goal-list"
import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"

type Props = {
  period: string | null
  employeeId: string | null
}

/**
 * 目標一覧をサーバ側 fetch してテーブル描画する非同期 RSC。
 * 各行は詳細 (/goals/[id]) へのリンクで、status はバッジ表示する。
 */
export async function GoalList(props: Props) {
  const goals = await getGoalList({
    period: props.period,
    employeeId: props.employeeId,
  })

  if (goals instanceof Error) {
    return <FetchError message="目標の取得に失敗しました" />
  }

  if (goals.length === 0) {
    return (
      <EmptyState
        title="目標がありません"
        description="右上の「新規目標」から目標を設定しましょう。"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>期間</TableHead>
            <TableHead>タイトル</TableHead>
            <TableHead>KPI</TableHead>
            <TableHead className="text-right">ウェイト</TableHead>
            <TableHead>ステータス</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {goals.map((goal) => (
            <TableRow key={goal.id}>
              <TableCell>{goal.period}</TableCell>

              <TableCell>
                <Link
                  href={`/performance-review/goals/${goal.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {goal.title}
                </Link>
              </TableCell>

              <TableCell>{goal.kpi ?? "-"}</TableCell>

              <TableCell className="text-right">{goal.weight}</TableCell>

              <TableCell>
                <Button type="button" variant="secondary" size="sm">
                  {statusLabel(goal.status)}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
