import { FetchError } from "@/components/fetch-error"
import { Suspense } from "react"
import { NotificationCreateForm } from "@/app/(app)/notifications/_components/notification-create-form"
import { NotificationList } from "@/app/(app)/notifications/_components/notification-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getEmployeeList } from "@/lib/api/get-employee-list"
import { getMe } from "@/lib/api/get-me"
import { getMyNotifications } from "@/lib/api/get-my-notifications"
import { canManageNotifications } from "@/lib/notifications/can-manage-notifications"

export const metadata = { title: "通知" }

const PAGE_SIZE = 20

type SearchParams = Promise<{ page?: string }>

// 通知画面。自分宛ての通知一覧を RSC で取得して表示し、特権ロールには作成フォームを併設する。
// 作成は api 側でも特権ロール限定のため、非特権ロールには作成フォームを出さない。
export default async function NotificationsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1)

  const offset = (page - 1) * PAGE_SIZE

  const currentUser = await getMe()

  const canCreate = currentUser instanceof Error ? false : canManageNotifications(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="通知" description="自分宛ての通知を確認します。" />

      <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-20 w-full" />}>
        <MyNotifications offset={offset} />
      </Suspense>

      {canCreate ? (
        <Suspense fallback={<ListSkeleton rows={2} />}>
          <NotificationCreateSection />
        </Suspense>
      ) : null}
    </div>
  )
}

async function MyNotifications(props: { offset: number }) {
  const result = await getMyNotifications({ limit: PAGE_SIZE, offset: props.offset })

  if (result instanceof Error) {
    return <FetchError message="通知一覧の取得に失敗しました" />
  }

  return (
    <div className="flex flex-col gap-4">
      <NotificationList notifications={result.data} />

      <TablePagination
        pathname="/notifications"
        total={result.total}
        limit={PAGE_SIZE}
        offset={props.offset}
      />
    </div>
  )
}

async function NotificationCreateSection() {
  const employeeResult = await getEmployeeList({ q: null, dept: null, status: "active" })

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.map((e) => ({ code: e.code, name: e.name }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>通知を作成</CardTitle>
      </CardHeader>

      <CardContent>
        <NotificationCreateForm employees={employees} />
      </CardContent>
    </Card>
  )
}
