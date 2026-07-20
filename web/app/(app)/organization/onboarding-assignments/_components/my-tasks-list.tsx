import { CompleteTaskButton } from "@/app/(app)/organization/onboarding-assignments/_components/complete-task-button"
import { UncompleteTaskButton } from "@/app/(app)/organization/onboarding-assignments/_components/uncomplete-task-button"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { getOnboardingMe } from "@/lib/api/get-onboarding-me"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * GET /onboarding/me を取得して自分のタスク一覧を描画する非同期 RSC。
 * pending のタスクには完了ボタン、done のタスクには取り消しボタンを出す。
 */
export async function MyTasksList() {
  const tasks = await getOnboardingMe()

  if (tasks instanceof Error) {
    return <FetchError message="タスクの取得に失敗しました" />
  }

  if (tasks.length === 0) {
    return <EmptyState title="割り当てられたタスクはありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>タスク</TableHead>
            <TableHead>状態</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="text-muted-foreground">{task.order}</TableCell>

              <TableCell className="font-medium">{task.title}</TableCell>

              <TableCell>
                <Badge variant={task.status === "done" ? "secondary" : "outline"}>
                  {task.status === "done" ? "完了" : "未完了"}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                {task.status === "pending" ? (
                  <CompleteTaskButton taskId={task.id} />
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {task.completed_at ?? "—"}
                    </span>

                    <UncompleteTaskButton taskId={task.id} />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
