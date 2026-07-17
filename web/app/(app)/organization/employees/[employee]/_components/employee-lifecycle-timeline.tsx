import {
  formatLifecycleDisplayStatus,
  formatLifecycleDate,
  formatLifecycleKind,
  summarizeLifecycleEvent,
} from "@/app/(app)/organization/employees/[employee]/_lib/format-lifecycle-event"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import type { EmployeeLifecycleEvents } from "@/lib/api/get-employee-lifecycle-events"
import Link from "next/link"

export function EmployeeLifecycleTimeline(props: {
  code: string
  events: EmployeeLifecycleEvents
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>人材タイムライン</CardTitle>
        <CardDescription>入社から配属、異動、休復職、退職までの確定履歴</CardDescription>
      </CardHeader>
      <CardContent>
        {props.events.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>人事発令はまだありません</EmptyTitle>
              <EmptyDescription>確定した発令がここへ時系列で表示されます。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="flex flex-col gap-3" aria-label="確定した人事発令">
            {props.events.data.map((event) => {
              const details = summarizeLifecycleEvent(event.summary)
              return (
                <li key={event.id} className="min-w-0 rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium break-words">{formatLifecycleKind(event.kind)}</p>
                      <p className="text-sm text-muted-foreground">
                        <time dateTime={event.event_on}>{formatLifecycleDate(event.event_on)}</time>
                      </p>
                    </div>
                    <Badge variant="outline">
                      {formatLifecycleDisplayStatus(event.display_status)}
                    </Badge>
                  </div>
                  {details.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                      {details.map((detail) => (
                        <li key={detail} className="break-words">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ol>
        )}
        {props.events.next_cursor !== null ? (
          <div className="mt-4">
            <Link
              href={`/organization/employees/${encodeURIComponent(props.code)}/timeline?cursor=${encodeURIComponent(props.events.next_cursor)}`}
              prefetch={false}
              className="text-sm font-medium underline underline-offset-4"
            >
              さらに履歴を表示
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
