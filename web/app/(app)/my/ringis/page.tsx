import { FetchError } from "@/components/fetch-error"
import { Inbox, Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getMyRingi } from "@/lib/api/get-my-ringi"
import { canViewAllRingi } from "@/lib/ringi/can-view-all-ringi"

export const metadata = { title: "稟議" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

/**
 * 自分の稟議一覧画面。「稟議」というオブジェクト一覧に集中させ、
 * 新規起案は /ringi/new、承認受信箱は /ringi/inbox に分離する。
 */
export default async function MyRingiPage() {
  const currentUser = await getMe()

  const canViewAll = currentUser instanceof Error ? false : canViewAllRingi(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="稟議"
        description="自分が起案した稟議の一覧と状態"
        actions={
          <>
            {canViewAll ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/organization/ringis" />}
              >
                稟議管理
              </Button>
            ) : null}

            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/company/inbox/ringis" />}
            >
              <Inbox />
              承認受信箱
            </Button>

            <Button nativeButton={false} render={<Link href="/my/ringis/new" />}>
              <Plus />
              新しい稟議
            </Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <MyRingiTable />
      </Suspense>
    </div>
  )
}

/** /ringi/me を認証付きで取得して一覧テーブルを描画する非同期 RSC。 */
async function MyRingiTable() {
  const ringiList = await getMyRingi(null)

  if (ringiList instanceof Error) {
    return <FetchError message="稟議一覧の取得に失敗しました" />
  }

  if (ringiList.length === 0) {
    return (
      <EmptyState
        title="起案済みの稟議はまだありません"
        description="右上の「新しい稟議」から最初の稟議を起案できます"
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>件名</TableHead>
            <TableHead>承認者</TableHead>
            <TableHead>金額</TableHead>
            <TableHead>ステータス</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {ringiList.map((ringi) => (
            <TableRow key={ringi.id}>
              <TableCell className="font-medium">{ringi.title}</TableCell>

              <TableCell className="text-muted-foreground">{ringi.approver_name}</TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(ringi.amount)} 円
              </TableCell>

              <TableCell>
                <ApplicationStatusBadge status={ringi.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
