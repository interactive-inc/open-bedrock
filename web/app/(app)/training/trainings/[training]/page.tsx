import Link from "next/link"
import { EnrollButton } from "@/app/(app)/training/trainings/_components/enroll-button"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getTrainingCourse } from "@/lib/api/get-training-course"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { canManageTraining } from "@/lib/training/can-manage-training"

type Props = {
  params: Promise<{ training: string }>
}

/**
 * 研修コース詳細ページ。動的セグメント [code] を受け取り RSC で取得して表示する。
 * active なコースには受講申込ボタンを、管理権限ユーザには編集リンクを出す。
 */
export default async function TrainingCourseDetailPage(props: Props) {
  const params = await props.params

  const course = await getTrainingCourse(params.training)

  if (course instanceof Error) {
    handleDetailError(course)
  }

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageTraining(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={course.title}
        actions={
          <>
            <BackButton href="/training/trainings" label="一覧に戻る" />

            {canManage ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={`/training/trainings/${course.code}/edit`} />}
              >
                編集
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>ステータス</span>

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
            <p className="text-sm text-muted-foreground">-</p>
          )}

          {course.status === "active" ? <EnrollButton courseCode={course.code} /> : null}
        </CardContent>
      </Card>
    </div>
  )
}
