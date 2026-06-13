import Link from "next/link"
import { EnrollButton } from "@/app/(app)/training/_components/enroll-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getTrainingCourse } from "@/lib/api/get-training-course"
import { handleDetailError } from "@/lib/api/handle-detail-error"

type Props = {
  params: Promise<{ code: string }>
}

// 研修コース詳細ページ。動的セグメント [code] を受け取り RSC で取得して表示する。
// active なコースには受講申込ボタンを出す。
export default async function TrainingCourseDetailPage(props: Props) {
  const params = await props.params

  const course = await getTrainingCourse(params.code)

  if (course instanceof Error) {
    handleDetailError(course)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/training" className="text-sm text-muted-foreground hover:underline">
          ← 研修一覧へ戻る
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>{course.title}</span>

            <Badge variant={course.status === "active" ? "outline" : "secondary"}>
              {course.status === "active" ? "公開中" : "アーカイブ"}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 text-muted-foreground">コード</dt>

              <dd className="font-medium">{course.code}</dd>
            </div>

            <div className="flex gap-2">
              <dt className="w-24 text-muted-foreground">カテゴリ</dt>

              <dd>{course.category}</dd>
            </div>

            <div className="flex gap-2">
              <dt className="w-24 text-muted-foreground">所要時間</dt>

              <dd>{course.duration_minutes === null ? "-" : `${course.duration_minutes} 分`}</dd>
            </div>

            <div className="flex gap-2">
              <dt className="w-24 text-muted-foreground">必須</dt>

              <dd>{course.is_required ? "必須" : "任意"}</dd>
            </div>
          </dl>

          {course.description !== null ? (
            <p className="text-sm">{course.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">説明はありません</p>
          )}

          {course.status === "active" ? <EnrollButton courseCode={course.code} /> : null}
        </CardContent>
      </Card>
    </div>
  )
}
