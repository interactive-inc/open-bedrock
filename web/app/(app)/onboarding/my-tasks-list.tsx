import { getOnboardingMe } from "@/lib/api/get-onboarding-me"
import { CompleteTaskButton } from "@/app/(app)/onboarding/complete-task-button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// GET /onboarding/me を取得して自分のタスク一覧を描画する非同期 RSC。
// pending のタスクには完了ボタンを出す。
export async function MyTasksList() {
  const tasks = await getOnboardingMe()

  if (tasks instanceof Error) {
    return <p className="text-sm text-destructive">タスクの取得に失敗しました</p>
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">割り当てられたタスクはありません</p>
  }

  return (
    <Table>
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
                <span className="text-xs text-muted-foreground">{task.completed_at ?? "—"}</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
