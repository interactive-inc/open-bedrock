import { CourseList } from "@/app/(app)/training/trainings/_components/course-list"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getTrainingCourses } from "@/lib/api/get-training-courses"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { canManageTraining } from "@/lib/training/can-manage-training"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"

export const metadata = { title: "研修コース" }

type SearchParams = Promise<{ page?: string; size?: string }>

/**
 * 研修コースの管理一覧。
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
    <div className="flex flex-col gap-8">
      <PageHeader title="研修コース">
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

  return (
    <div className="flex flex-col gap-4">
      <CourseList courses={result.data} />

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
