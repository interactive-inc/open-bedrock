import { Suspense } from "react"
import { NotificationCreateForm } from "@/app/(app)/notifications/notification-create-form"
import { NotificationList } from "@/app/(app)/notifications/notification-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getMe } from "@/lib/api/get-me"
import { getMyNotifications } from "@/lib/api/get-my-notifications"
import { canManageNotifications } from "@/lib/notifications/can-manage-notifications"

export const metadata = { title: "通知" }

// 通知画面。自分宛ての通知一覧を RSC で取得して表示し、特権ロールには作成フォームを併設する。
// 作成は api 側でも特権ロール限定のため、非特権ロールには作成フォームを出さない。
export default async function NotificationsPage() {
  const currentUser = await getMe()

  const canCreate = currentUser instanceof Error ? false : canManageNotifications(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">通知</h1>
      </div>

      <Suspense fallback={<NotificationsSkeleton />}>
        <MyNotifications />
      </Suspense>

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>通知を作成</CardTitle>
          </CardHeader>

          <CardContent>
            <NotificationCreateForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// /notifications/me を認証付きで取得して一覧を描画する非同期 RSC。
async function MyNotifications() {
  const notifications = await getMyNotifications()

  if (notifications instanceof Error) {
    return <p className="text-sm text-destructive">通知一覧の取得に失敗しました</p>
  }

  return <NotificationList notifications={notifications} />
}

function NotificationsSkeleton() {
  const placeholders = [0, 1, 2]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-20 w-full" />
      ))}
    </div>
  )
}
