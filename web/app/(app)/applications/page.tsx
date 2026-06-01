import Link from "next/link"
import { Suspense } from "react"
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
import { getMyApplications } from "@/lib/api/get-my-applications"

export const metadata = { title: "申請" }

// 自分の申請一覧画面。RSC でサーバ取得し、テーブル表示する。
export default function MyApplicationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">申請</h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/applications/inbox" />}>
            承認 inbox
          </Button>

          <Button render={<Link href="/applications/templates" />}>新規申請</Button>
        </div>
      </div>

      <Suspense fallback={<MyApplicationsSkeleton />}>
        <MyApplicationsTable />
      </Suspense>
    </div>
  )
}

// /applications を認証付きで取得して一覧テーブルを描画する非同期 RSC。
async function MyApplicationsTable() {
  const applications = await getMyApplications(null)

  if (applications instanceof Error) {
    return <p className="text-sm text-destructive">申請一覧の取得に失敗しました</p>
  }

  if (applications.length === 0) {
    return <p className="text-sm text-muted-foreground">提出済みの申請はまだありません</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>申請名</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>現在のステップ</TableHead>
          <TableHead>申請日</TableHead>
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

            <TableCell>
              <ApplicationStatusBadge status={application.status} />
            </TableCell>

            <TableCell className="text-muted-foreground">
              {application.current_step ?? "-"}
            </TableCell>

            <TableCell className="text-muted-foreground">{application.created_at}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function MyApplicationsSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
