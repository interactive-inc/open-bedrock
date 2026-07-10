import { FetchError } from "@/components/fetch-error"
import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { NotificationList } from "@/app/(app)/notifications/_components/notification-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { PAGE_SIZE_OPTIONS, TablePagination, parsePageSize } from "@/components/table-pagination"
import { Button } from "@/components/ui/button"
import { getMe } from "@/lib/api/get-me"
import { getMyNotifications } from "@/lib/api/get-my-notifications"
import { canManageNotifications } from "@/lib/notifications/can-manage-notifications"

export const metadata = { title: "通知" }

type SearchParams = Promise<{ page?: string; size?: string }>

// 通知画面。自分宛ての通知一覧を RSC で取得して表示する。
// 作成は /notifications/new に分離し、特権ロールにだけ導線を出す。
export default async function NotificationsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const pageSize = parsePageSize(searchParams.size)

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const currentUser = await getMe()

  const canCreate = currentUser instanceof Error ? false : canManageNotifications(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="通知"
        description="自分宛ての通知を確認します。"
        actions={
          canCreate ? (
            <Button nativeButton={false} render={<Link href="/notifications/new" />}>
              <Plus />
              通知を作成
            </Button>
          ) : null
        }
      />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-20 w-full" />}>
        <MyNotifications offset={offset} pageSize={pageSize} />
      </Suspense>
    </div>
  )
}

async function MyNotifications(props: { offset: number; pageSize: number }) {
  const result = await getMyNotifications({ limit: props.pageSize, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="通知一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <NotificationList notifications={result.data} />

      <TablePagination
        pathname="/notifications"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={{ size: String(props.pageSize) }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}
