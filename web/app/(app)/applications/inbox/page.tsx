import Link from "next/link"
import { Suspense } from "react"
import { InboxDecisionForm } from "@/app/(app)/applications/inbox/inbox-decision-form"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getApplicationInbox } from "@/lib/api/get-application-inbox"

// 承認 inbox 画面。RSC で承認待ち一覧を取得し、各行に承認/却下フォームを置く。
export default function ApplicationInboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">承認 inbox</h1>

        <Button variant="outline" render={<Link href="/applications" />}>
          申請一覧へ
        </Button>
      </div>

      <Suspense fallback={<InboxSkeleton />}>
        <InboxTable />
      </Suspense>
    </div>
  )
}

// /applications/inbox を認証付きで取得して承認待ちテーブルを描画する非同期 RSC。
async function InboxTable() {
  const applications = await getApplicationInbox()

  if (applications instanceof Error) {
    return <p className="text-sm text-destructive">inbox の取得に失敗しました</p>
  }

  if (applications.length === 0) {
    return <p className="text-sm text-muted-foreground">承認待ちの申請はありません</p>
  }

  return (
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
  )
}

function InboxSkeleton() {
  const placeholders = [0, 1, 2, 3]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  )
}
