import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { CourseList } from "@/app/(app)/training/_components/course-list"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getMyTrainingEnrollments } from "@/lib/api/get-my-training-enrollments"
import { getTrainingCourses } from "@/lib/api/get-training-courses"
import { canManageTraining } from "@/lib/training/can-manage-training"

export const metadata = { title: "研修" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ page?: string }>

/**
 * 研修コース一覧。自分の受講は /training/me、新規作成は /training/new に分離する。
 */
export default async function TrainingPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageTraining(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="研修"
        description="研修コースの一覧から受講を申し込みます。"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/training/me" />}>
              自分の受講
            </Button>

            {canManage ? (
              <Button nativeButton={false} render={<Link href="/training/new" />}>
                <Plus />
                新規コース
              </Button>
            ) : null}
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Courses offset={offset} />
      </Suspense>
    </div>
  )
}

async function Courses(props: { offset: number }) {
  const result = await getTrainingCourses({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="研修コースの取得に失敗しました" />
  }

  const enrollments = await getMyTrainingEnrollments()

  const enrolledCourseIds =
    enrollments instanceof Error ? [] : enrollments.map((enrollment) => enrollment.course_id)

  return (
    <div className="flex flex-col gap-4">
      <CourseList courses={result.data} enrolledCourseIds={enrolledCourseIds} />

      <TablePagination
        pathname="/training"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}
