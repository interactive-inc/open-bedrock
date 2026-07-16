import { EmployeeLifecycleTimeline } from "@/app/(app)/employees/[code]/_components/employee-lifecycle-timeline"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { PageHeader } from "@/components/page-header"
import { getEmployeeLifecycleEvents } from "@/lib/api/get-employee-lifecycle-events"

export const metadata = { title: "人材タイムライン" }

export default async function EmployeeTimelinePage(props: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ cursor?: string }>
}) {
  const [{ code }, query] = await Promise.all([props.params, props.searchParams])
  const events = await getEmployeeLifecycleEvents(code, { cursor: query.cursor })
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="人材タイムライン"
        actions={<BackButton href={`/employees/${encodeURIComponent(code)}`} label="詳細に戻る" />}
      />
      {events instanceof Error ? (
        <FetchError message="人事タイムラインの取得に失敗しました" />
      ) : (
        <EmployeeLifecycleTimeline code={code} events={events} />
      )}
    </div>
  )
}
