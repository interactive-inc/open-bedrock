import { notFound } from "next/navigation"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { AnnouncementManageActions } from "@/app/(app)/announcement/announcements/[announcement]/_components/announcement-manage-actions"
import { getAnnouncementDetail } from "@/lib/api/get-announcement-detail"
import { getMe } from "@/lib/api/get-me"
import { canManageAnnouncements } from "@/lib/announcement/can-manage-announcements"
import { handleDetailError } from "@/lib/api/handle-detail-error"

export const metadata = { title: "アナウンス詳細" }

type Props = {
  params: Promise<{ announcement: string }>
}

/** id 文字列を正の整数へ変換する。無効なら null。 */
function toAnnouncementId(rawId: string): number | null {
  const parsed = Number(rawId)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/** /announcements/:id 詳細画面。本文を表示し、管理者には公開・アーカイブ操作を出す。 */
export default async function AnnouncementDetailPage(props: Props) {
  const params = await props.params

  const announcementId = toAnnouncementId(params.announcement)

  if (announcementId === null) {
    notFound()
  }

  const announcement = await getAnnouncementDetail(announcementId)

  if (announcement instanceof Error) {
    handleDetailError(announcement)
  }

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageAnnouncements(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={announcement.title}
        description={`状態: ${announcement.status}${
          announcement.published_on === null ? "" : ` / 公開日: ${announcement.published_on}`
        }`}
        actions={<BackButton href="/announcement/announcements" label="一覧に戻る" />}
      />

      {canManage ? (
        <AnnouncementManageActions announcementId={announcement.id} status={announcement.status} />
      ) : null}

      <Card className="p-0 gap-0">
        <article className="whitespace-pre-wrap p-6 text-sm leading-relaxed">
          {announcement.body_md}
        </article>
      </Card>
    </div>
  )
}
