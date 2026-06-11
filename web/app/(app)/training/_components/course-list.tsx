import Link from "next/link"
import { EnrollButton } from "@/app/(app)/training/_components/enroll-button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { TrainingCourseResponse } from "@/lib/api/types/training-types"

type Props = {
  courses: Array<TrainingCourseResponse>
  enrolledCourseIds: ReadonlyArray<number>
}

// 研修コース一覧。コード・名前・カテゴリ・必須/状態をテーブルで表示する。
// 受講申込済みのコースには申込済バッジを、未申込の active コースには受講申込ボタンを出す。
export function CourseList(props: Props) {
  if (props.courses.length === 0) {
    return <p className="text-sm text-muted-foreground">研修コースはまだありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>コード</TableHead>
          <TableHead>コース名</TableHead>
          <TableHead>カテゴリ</TableHead>
          <TableHead>必須</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {props.courses.map((course) => {
          const isEnrolled = course.id !== null && props.enrolledCourseIds.includes(course.id)

          return (
            <TableRow key={course.id}>
              <TableCell className="font-medium">{course.code}</TableCell>

              <TableCell>
                <Link
                  href={`/training/${course.code}`}
                  className="underline-offset-4 hover:underline"
                >
                  {course.title}
                </Link>
              </TableCell>

              <TableCell>{course.category}</TableCell>

              <TableCell>
                {course.is_required ? <Badge variant="secondary">必須</Badge> : "-"}
              </TableCell>

              <TableCell>
                <Badge variant={course.status === "active" ? "outline" : "secondary"}>
                  {course.status === "active" ? "公開中" : "アーカイブ"}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                {isEnrolled ? (
                  <Badge variant="secondary">申込済み</Badge>
                ) : course.status === "active" ? (
                  <EnrollButton courseCode={course.code} />
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
