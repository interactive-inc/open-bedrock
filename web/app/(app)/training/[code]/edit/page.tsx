import { notFound } from "next/navigation"
import { ArchiveCourseButton } from "@/app/(app)/training/[code]/edit/_components/archive-course-button"
import { UpdateCourseForm } from "@/app/(app)/training/[code]/edit/_components/update-course-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getTrainingCourse } from "@/lib/api/get-training-course"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { canManageTraining } from "@/lib/training/can-manage-training"

export const metadata = { title: "研修コースの編集" }

type Props = {
  params: Promise<{ code: string }>
}

/**
 * 研修コース編集ページ。管理権限がない場合は notFound() で隠す。
 */
export default async function EditTrainingCoursePage(props: Props) {
  const params = await props.params

  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageTraining(currentUser.role) === false) {
    notFound()
  }

  const course = await getTrainingCourse(params.code)

  if (course instanceof Error) {
    handleDetailError(course)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${course.title} の編集`}
        description="コードと状態は変更されません。"
        actions={<BackButton href={`/training/${course.code}`} label="詳細に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <UpdateCourseForm course={course} />
        </CardContent>
      </Card>

      {course.status === "active" ? (
        <Card className="max-w-xl">
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              アーカイブすると新規受講の申込みができなくなります。
            </p>

            <ArchiveCourseButton code={course.code} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
