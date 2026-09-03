import { Suspense } from "react"
import { MyEnrollmentList } from "@/app/(app)/training/trainings/_components/my-enrollment-list"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMyTrainingEnrollments } from "@/lib/api/get-my-training-enrollments"
import { getTrainingCourses } from "@/lib/api/get-training-courses"

export const metadata = { title: "自分の受講" }

/**
 * 自分の受講一覧。コース一覧 /training から分離した本人スコープのページ。
 */
export default function MyTrainingEnrollmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="自分の受講"
        description="受講中・受講済みのコースを確認します。"
        actions={<BackButton href="/training/trainings" label="研修に戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <MyEnrollments />
      </Suspense>
    </div>
  )
}

async function MyEnrollments() {
  const enrollments = await getMyTrainingEnrollments()

  if (enrollments instanceof Error) {
    return <FetchError message="受講一覧の取得に失敗しました" />
  }

  const courses = await getTrainingCourses({ limit: 100, offset: 0 })

  const courseList = courses instanceof Error ? [] : courses.data

  return <MyEnrollmentList enrollments={enrollments} courses={courseList} />
}
