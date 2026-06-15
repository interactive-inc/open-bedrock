import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { InboxDecisionForm } from "@/app/(app)/applications/inbox/_components/inbox-decision-form"
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
import { getApplicationInbox } from "@/lib/api/get-application-inbox"

export const metadata = { title: "承認待ちの申請" }

// 承認 inbox 画面。RSC で承認待ち一覧を取得し、各行に承認/却下フォームを置く。
export default function ApplicationInboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="申請の承認 inbox"
        description="承認待ちの申請を確認します。"
        actions={
          <Button variant="outline" render={<Link href="/applications" />}>
            申請一覧へ
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={4} rowClassName="h-16 w-full" />}>
        <InboxTable />
      </Suspense>
    </div>
  )
}

// /applications/inbox を認証付きで取得して承認待ちテーブルを描画する非同期 RSC。
async function InboxTable() {
  const applications = await getApplicationInbox()

  if (applications instanceof Error) {
    return <FetchError message="inbox の取得に失敗しました" />
  }

  if (applications.length === 0) {
    return <EmptyState title="承認待ちの申請はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>申請名</TableHead>
            <TableHead>申請者</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>申請日</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {applications.map((application) => (
            <TableRow key={application.id}>
              <TableCell>
                <Link
                  href={`/applications/${application.id}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {application.template_name}
                </Link>
              </TableCell>

              <TableCell className="text-muted-foreground">{application.applicant_name}</TableCell>

              <TableCell>
                <ApplicationStatusBadge status={application.status} />
              </TableCell>

              <TableCell className="text-muted-foreground">{application.created_at}</TableCell>

              <TableCell>
                <InboxDecisionForm applicationId={application.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
