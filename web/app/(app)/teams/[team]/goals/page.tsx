import { DepartmentName } from "@/app/(app)/teams/[team]/_components/department-name"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDepartmentGoals } from "@/lib/api/get-department-goals"
import { statusLabel } from "@/lib/status-label"

export const metadata = { title: "部署の目標" }

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署ハブの目標タブ。所属メンバー全員の目標と部門目標を一覧する。
 * 閲覧には goal:read:all、または本人が所属する部署への goal:read:department が必要。
 */
export default async function DepartmentGoalsPage(props: Props) {
  const params = await props.params

  const goals = await getDepartmentGoals(params.team)

  if (goals instanceof Error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="部署の目標" />

        <DepartmentName team={params.team} />

        <EmptyState title="この部署の目標を閲覧する権限がありません" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="部署の目標" />

      <DepartmentName team={params.team} />

      {goals.length === 0 ? (
        <EmptyState title="この部署の目標はまだありません" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>期間</TableHead>

                <TableHead>タイトル</TableHead>

                <TableHead>区分</TableHead>

                <TableHead>ウェイト</TableHead>

                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {goals.map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell className="whitespace-nowrap">{goal.period}</TableCell>

                  <TableCell>{goal.title}</TableCell>

                  <TableCell className="whitespace-nowrap">
                    {goal.owner_type === "department"
                      ? "部門目標"
                      : goal.owner_type === "company"
                        ? "全社目標"
                        : "個人目標"}
                  </TableCell>

                  <TableCell>{goal.weight}</TableCell>

                  <TableCell className="whitespace-nowrap">{statusLabel(goal.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
