import { notFound } from "next/navigation"
import { MeetingNewForm } from "@/app/(app)/meeting/meetings/_components/meeting-new-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageMeetings } from "@/lib/meeting/can-manage-meetings"

export const metadata = { title: "会議体の登録" }

/**
 * 会議体の新規登録ページ（meeting:manage のみ）。
 */
export default async function NewMeetingPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageMeetings(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="会議体を登録">
        <BackButton href="/meeting/meetings" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <MeetingNewForm />
        </CardContent>
      </Card>
    </div>
  )
}
