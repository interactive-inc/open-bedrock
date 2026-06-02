"use client"

import { useActionState } from "react"
import { toast } from "sonner"
import type { NotificationFormState } from "@/app/(app)/notifications/actions"
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(app)/notifications/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { NotificationResponse } from "@/lib/api/types/notification-types"

type Props = {
  notifications: Array<NotificationResponse>
}

const initialState: NotificationFormState = { ok: false, error: null }

// 通知一覧。各通知を Card で並べ、未読には既読化ボタンを出す。
// 既読化・全件既読の結果は action の戻り値を見て toast で通知する（useEffect は使わない）。
export function NotificationList(props: Props) {
  const markAction = useActionState(markNotificationReadAction, initialState)

  const markState = markAction[0]

  const markDispatch = markAction[1]

  const markAllAction = useActionState(markAllNotificationsReadAction, initialState)

  const markAllState = markAllAction[0]

  const markAllDispatch = markAllAction[1]

  const isMarkingAll = markAllAction[2]

  if (markState.ok) {
    toast.success("既読にしました")
  } else if (markState.error !== null) {
    toast.error(markState.error)
  }

  if (markAllState.ok) {
    toast.success("すべて既読にしました")
  } else if (markAllState.error !== null) {
    toast.error(markAllState.error)
  }

  if (props.notifications.length === 0) {
    return <p className="text-sm text-muted-foreground">通知はありません</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <form action={markAllDispatch}>
          <Button type="submit" variant="outline" disabled={isMarkingAll}>
            すべて既読にする
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {props.notifications.map((notification) => (
          <Card key={notification.id} className={notification.is_read ? "opacity-70" : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{notification.title}</span>

                  {notification.is_read ? (
                    <Badge variant="outline">既読</Badge>
                  ) : (
                    <Badge>未読</Badge>
                  )}
                </div>

                <span className="text-xs text-muted-foreground">{notification.created_at}</span>
              </div>
            </CardHeader>

            <CardContent className="flex items-start justify-between gap-4">
              <p className="whitespace-pre-wrap text-sm">{notification.body}</p>

              {notification.is_read ? null : (
                <form action={markDispatch}>
                  <input type="hidden" name="notification_id" value={notification.id ?? ""} />

                  <Button type="submit" variant="secondary" size="sm">
                    既読にする
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
