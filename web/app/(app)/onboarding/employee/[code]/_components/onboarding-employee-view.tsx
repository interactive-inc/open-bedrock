import { AssignmentActions } from "@/app/(app)/onboarding/_components/assignment-actions"
import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { Badge } from "@/components/ui/badge"
import { getOnboardingEmployee } from "@/lib/api/get-onboarding-employee"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  code: string
}

// GET /onboarding/employee/:code を取得し、社員の割当ごとにタスクを描画する非同期 RSC。
// 各割当には特権ロール向けの割当日変更・取り消し操作を出す。
export async function OnboardingEmployeeView(props: Props) {
  const assignments = await getOnboardingEmployee(props.code)

  if (assignments instanceof Error) {
    return <FetchError message="割当の取得に失敗しました（権限がない可能性があります）" />
  }

  if (assignments.length === 0) {
    return <EmptyState title="割当がありません" />
  }

  return (
    <div className="flex flex-col gap-4">
      {assignments.map((assignment) => (
        <Card key={assignment.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {assignment.template_name}

              <Badge variant={assignment.kind === "join" ? "default" : "secondary"}>
                {assignment.kind === "join" ? "入社" : "退社"}
              </Badge>

              <Badge variant={assignment.status === "completed" ? "secondary" : "outline"}>
                {assignment.status === "completed" ? "完了" : "進行中"}
              </Badge>
            </CardTitle>

            <CardDescription>
              {assignment.employee_name}（{assignment.employee_code}） / 割当日{" "}
              {assignment.assigned_at}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>タスク</TableHead>
                    <TableHead>状態</TableHead>
                    <TableHead className="text-right">完了日時</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {assignment.tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="text-muted-foreground">{task.order}</TableCell>

                      <TableCell className="font-medium">{task.title}</TableCell>

                      <TableCell>
                        <Badge variant={task.status === "done" ? "secondary" : "outline"}>
                          {task.status === "done" ? "完了" : "未完了"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right text-xs text-muted-foreground">
                        {task.completed_at ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>

          <CardFooter>
            <AssignmentActions
              assignmentId={assignment.id}
              employeeCode={assignment.employee_code}
              assignedAt={assignment.assigned_at}
            />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
