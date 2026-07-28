import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { RingiDecisionForm } from "@/app/(app)/my/ringis/_components/ringi-decision-form"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { SubPageHeader } from "@/components/sub-page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getRingiInbox } from "@/lib/api/get-ringi-inbox"

export const metadata = { title: "承認待ちの稟議" }

const amountFormatter = new Intl.NumberFormat("ja-JP")

/**
 * 稟議承認 inbox 画面。承認者向けに承認待ちの稟議を RSC で取得し一覧表示する。
 * 稟議には詳細ページが無いため、承認・却下フォームを各行に直接埋め込む。
 */
export default function RingiInboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <SubPageHeader
        title="承認待ちの稟議"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/my/ringis" />}>
            自分の稟議へ
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <RingiInboxTable />
      </Suspense>
    </div>
  )
}

/** /ringi/inbox を認証付きで取得して承認待ち一覧テーブルを描画する非同期 RSC。 */
async function RingiInboxTable() {
  const ringiList = await getRingiInbox()

  if (ringiList instanceof Error) {
    return <FetchError message="承認 inbox の取得に失敗しました（権限がない可能性があります）" />
  }

  if (ringiList.length === 0) {
    return <EmptyState title="承認待ちの稟議はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>申請者</TableHead>
            <TableHead>件名</TableHead>
            <TableHead>金額</TableHead>
            <TableHead>理由</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {ringiList.map((ringi) => (
            <TableRow key={ringi.id}>
              <TableCell className="font-medium">{ringi.applicant_name}</TableCell>

              <TableCell>{ringi.title}</TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(ringi.amount)} 円
              </TableCell>

              <TableCell className="max-w-xs text-muted-foreground">{ringi.reason}</TableCell>

              <TableCell className="text-right">
                <RingiDecisionForm ringiId={ringi.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
