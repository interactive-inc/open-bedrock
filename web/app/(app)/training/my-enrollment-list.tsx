import { CompleteEnrollmentButton } from "@/app/(app)/training/complete-enrollment-button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  TrainingCourseResponse,
  TrainingEnrollmentResponse,
} from "@/lib/api/types/training-types"

type Props = {
  enrollments: Array<TrainingEnrollmentResponse>
  courses: Array<TrainingCourseResponse>
}

// 自分の受講一覧。コース名・状態・期限・完了日をテーブルで表示する。
// enrolled の受講には完了ボタンを出す。コース名は courses から course_id で引く。
export function MyEnrollmentList(props: Props) {
  if (props.enrollments.length === 0) {
    return <p className="text-sm text-muted-foreground">受講中・受講済みのコースはありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>コース</TableHead>
          <TableHead>状態</TableHead>
          <TableHead>期限</TableHead>
          <TableHead>完了日</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.enrollments.map((enrollment) => {
          const course = props.courses.find((candidate) => candidate.id === enrollment.course_id)

          const courseLabel = course === undefined ? `#${enrollment.course_id}` : course.title

          return (
            <TableRow key={enrollment.id}>
              <TableCell className="font-medium">{courseLabel}</TableCell>

              <TableCell>
                <Badge variant={enrollment.status === "completed" ? "secondary" : "outline"}>
                  {enrollment.status === "completed" ? "受講済み" : "受講中"}
                </Badge>
              </TableCell>

              <TableCell className="text-muted-foreground">{enrollment.due_date ?? "-"}</TableCell>

              <TableCell className="text-muted-foreground">
                {enrollment.completed_at ?? "-"}
              </TableCell>

              <TableCell className="text-right">
                {enrollment.status === "enrolled" ? (
                  <CompleteEnrollmentButton enrollmentId={enrollment.id} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
