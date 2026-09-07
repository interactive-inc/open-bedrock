import { RingiProcedureActionForm } from "@/app/(app)/my/ringis/_components/ringi-procedure-action-form"
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
 * 判断対象と必要人数を表示し、内容と履歴は詳細ページでも確認できる。
 */
export default async function RingiInboxPage(props: {
  searchParams: Promise<{ offset?: string }>
}) {
  const params = await props.searchParams
  const offset = Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0)
  return (
    <div className="flex flex-col gap-8">
      <SubPageHeader
        title="承認待ちの稟議"
        actions={
          <Button variant="secondary" nativeButton={false} render={<Link href="/my/ringis" />}>
            自分の稟議へ
          </Button>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <RingiInboxTable offset={offset} />
      </Suspense>
    </div>
  )
}

/** /ringi/inbox を認証付きで取得して承認待ち一覧テーブルを描画する非同期 RSC。 */
async function RingiInboxTable(props: { offset: number }) {
  const result = await getRingiInbox(props.offset)

  if (result instanceof Error) {
    return <FetchError message="承認 inbox の取得に失敗しました（権限がない可能性があります）" />
  }

  const ringiList = result.data

  if (ringiList.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title="このページに承認待ちの稟議はありません" />
        <Link href="/inbox/ringis">先頭に戻る</Link>
        {result.next_offset !== null ? (
          <Link href={`/inbox/ringis?offset=${result.next_offset}`}>次のページ</Link>
        ) : null}
      </div>
    )
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
              <TableCell>{ringi.applicant_name}</TableCell>

              <TableCell>
                <Link href={`/my/ringis/${ringi.id}`}>{ringi.title}</Link>
                <p>
                  {ringi.approvals} / {ringi.required_approvals ?? "—"} 名の承認
                </p>
              </TableCell>

              <TableCell className="tabular-nums">
                {amountFormatter.format(ringi.amount)} 円
              </TableCell>

              <TableCell>{ringi.reason}</TableCell>

              <TableCell className="text-right">
                {ringi.can_decide && ringi.decision_target !== null ? (
                  <RingiDecisionForm
                    key={JSON.stringify(ringi.decision_target)}
                    ringiId={ringi.id}
                    decisionTarget={ringi.decision_target}
                  />
                ) : null}
                {ringi.can_execute && ringi.decision_target !== null ? (
                  <RingiProcedureActionForm
                    ringiId={ringi.id}
                    decisionTarget={ringi.decision_target}
                    operation="execute"
                  />
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <nav aria-label="稟議のページ">
        <Link href="/inbox/ringis">先頭に戻る</Link>
        {result.next_offset !== null ? (
          <Link href={`/inbox/ringis?offset=${result.next_offset}`}>次のページ</Link>
        ) : null}
      </nav>
    </div>
  )
}
