import { Suspense } from "react"
import { MeetingMinutesList } from "@/app/(app)/meeting/meetings/[meeting]/_components/meeting-minutes-list"
import { MeetingMinutesForm } from "@/app/(app)/meeting/meetings/[meeting]/_components/meeting-minutes-form"
import { BackButton } from "@/components/back-button"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMeetingDetail } from "@/lib/api/get-meeting-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import { Button } from "@/components/ui/button"

export const metadata = { title: "会議体詳細" }

type Props = {
  params: Promise<{ meeting: string }>
}

/** /meetings/:code 会議体詳細。会議体の情報・議事録一覧・議事録記録フォームを表示する。 */
export default async function MeetingDetailPage(props: Props) {
  const params = await props.params

  const code = params.meeting

  const meeting = await getMeetingDetail(code)

  if (meeting instanceof Error) {
    handleDetailError(meeting)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={meeting.name}>
        <BackButton href="/meeting/meetings" label="一覧に戻る" />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {meeting.status === "archived" ? (
          <Button type="button" variant="secondary" size="sm">
            アーカイブ
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm">
            {meeting.cadence ?? "随時"}
          </Button>
        )}
      </div>

      {meeting.description === null ? null : (
        <Card className="gap-0">
          <p className="whitespace-pre-wrap p-4 text-sm text-muted-foreground">
            {meeting.description}
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">議事録</h2>

        <Suspense fallback={<ListSkeleton rows={3} rowClassName="h-16 w-full" />}>
          <MeetingMinutesList code={code} />
        </Suspense>
      </div>

      <Card>
        <CardContent>
          <h2 className="mb-4 text-lg font-medium">議事録を記録</h2>

          <MeetingMinutesForm code={code} />
        </CardContent>
      </Card>
    </div>
  )
}
