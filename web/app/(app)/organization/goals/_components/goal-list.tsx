import { FetchError } from "@/components/fetch-error"
import { statusLabel } from "@/lib/status-label"
import Link from "next/link"
import { getGoalList } from "@/lib/api/get-goal-list"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  period: string | null
  employeeId: string | null
}

// 目標一覧をサーバ側 fetch してテーブル描画する非同期 RSC。
// 各行は詳細 (/goals/[id]) へのリンクで、status はバッジ表示する。
export async function GoalList(props: Props) {
  const employeeId = props.employeeId !== null ? Number(props.employeeId) : null

  const goals = await getGoalList({
    period: props.period,
    employeeId: employeeId !== null && Number.isInteger(employeeId) ? employeeId : null,
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
                  href={`/organization/goals/${goal.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {goal.title}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">{goal.kpi ?? "-"}</TableCell>

              <TableCell className="text-right">{goal.weight}</TableCell>

              <TableCell>
                <Badge variant={goal.status === "done" ? "secondary" : "outline"}>
                  {statusLabel(goal.status)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
