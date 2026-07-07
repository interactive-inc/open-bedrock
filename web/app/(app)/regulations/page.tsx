import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { RegulationCreateForm } from "@/app/(app)/regulations/_components/regulation-create-form"
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
import { getRegulationList } from "@/lib/api/get-regulation-list"
import { canManageRegulations } from "@/lib/regulation/can-manage-regulations"

export const metadata = { title: "規程集" }

// 規程集一覧画面。全員が閲覧でき、管理者は新規登録もできる。
export default async function RegulationsPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageRegulations(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="規程集" description="社内規程の最新版と改定履歴を確認します。" />

      {canManage ? <RegulationCreateForm /> : null}

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <RegulationsTable />
      </Suspense>
    </div>
  )
}

// /regulations を取得して一覧テーブルを描画する非同期 RSC。
async function RegulationsTable() {
  const regulations = await getRegulationList({ status: null })

  if (regulations instanceof Error) {
    return <FetchError message="規程一覧の取得に失敗しました" />
  }

  if (regulations.length === 0) {
    return <EmptyState title="規程はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="規程集一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>タイトル</TableHead>
            <TableHead>最新版</TableHead>
            <TableHead>施行日</TableHead>
            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {regulations.map((regulation) => (
            <TableRow key={regulation.code}>
              <TableCell>
                <Link
                  href={`/regulations/${regulation.code}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {regulation.code}
                </Link>
              </TableCell>

              <TableCell>{regulation.title}</TableCell>

              <TableCell className="text-muted-foreground">
                {regulation.latest_version === null ? "-" : `v${regulation.latest_version}`}
              </TableCell>

              <TableCell className="text-muted-foreground">
                {regulation.effective_on ?? "-"}
              </TableCell>

              <TableCell className="text-muted-foreground">{regulation.status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
