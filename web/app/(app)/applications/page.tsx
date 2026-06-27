import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { Suspense } from "react"
import { MyApplicationsList } from "@/app/(app)/applications/_components/my-applications-list"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { listMyApplications } from "@/lib/api/list-my-applications"

export const metadata = { title: "申請" }

// 自分の申請一覧画面。RSC でサーバ取得し、承認待ちは変更・取り下げ操作付きで表示する。
export default function MyApplicationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="申請"
        description="自分の申請の状況を確認します。"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/applications/inbox" />}>
              承認 inbox
            </Button>

            <Button nativeButton={false} render={<Link href="/applications/templates" />}>新規申請</Button>
          </>
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <MyApplicationsTable />
      </Suspense>
    </div>
  )
}

// /applications/me を認証付きで取得して操作付き一覧を描画する非同期 RSC。
async function MyApplicationsTable() {
  const applications = await listMyApplications()

  if (applications instanceof Error) {
    return <FetchError message="申請一覧の取得に失敗しました" />
  }

  return <MyApplicationsList applications={applications} />
}
