import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { CourseList } from "@/app/(app)/training/trainings/_components/course-list"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getMyTrainingEnrollments } from "@/lib/api/get-my-training-enrollments"
import { getTrainingCourses } from "@/lib/api/get-training-courses"
import { canManageTraining } from "@/lib/training/can-manage-training"

export const metadata = { title: "研修コース" }

type SearchParams = Promise<{ page?: string; size?: string }>

/**
 * 研修コース一覧。自分の受講は /training/me、新規作成は /training/new に分離する。
 */
export default async function TrainingPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const pageSize = parsePageSize(searchParams.size)

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageTraining(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="研修コース">
        <Button variant="secondary" nativeButton={false} render={<Link href="/my/trainings" />}>
          自分の受講
        </Button>

        {canManage ? (
          <Button nativeButton={false} render={<Link href="/training/trainings/new" />}>
            <Plus />
            新規コース
          </Button>
        ) : null}
      </PageHeader>

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Courses offset={offset} pageSize={pageSize} />
      </Suspense>
    </div>
  )
}

async function Courses(props: { offset: number; pageSize: number }) {
  const result = await getTrainingCourses({ limit: props.pageSize, offset: props.offset })

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
        pathname="/training/trainings"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={{ size: String(props.pageSize) }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
