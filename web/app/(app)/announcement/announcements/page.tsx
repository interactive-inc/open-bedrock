import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { AnnouncementCreateForm } from "@/app/(app)/announcement/announcements/_components/announcement-create-form"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getAnnouncementList } from "@/lib/api/get-announcement-list"
import { canManageAnnouncements } from "@/lib/announcement/can-manage-announcements"

export const metadata = { title: "アナウンス" }

/** アナウンス一覧画面。全員は公開分を閲覧し、管理者は下書き作成もできる。 */
export default async function AnnouncementsPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageAnnouncements(currentUser.permissions)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="アナウンス" />

      {canManage ? <AnnouncementCreateForm /> : null}

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <AnnouncementsTable />
      </Suspense>
    </div>
  )
}

/** /announcements を取得して一覧テーブルを描画する非同期 RSC。 */
async function AnnouncementsTable() {
  const announcements = await getAnnouncementList({ status: null })

  if (announcements instanceof Error) {
    return <FetchError message="アナウンス一覧の取得に失敗しました" />
  }

  if (announcements.length === 0) {
    return <EmptyState title="アナウンスはありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="アナウンス一覧">
        <TableHeader>
          <TableRow>
            <TableHead>タイトル</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>公開日</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {announcements.map((announcement) => (
            <TableRow key={announcement.id}>
              <TableCell>
                <Link
                  href={`/announcement/announcements/${announcement.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {announcement.title}
                </Link>
              </TableCell>

              <TableCell>{announcement.status}</TableCell>

              <TableCell>{announcement.published_on ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
