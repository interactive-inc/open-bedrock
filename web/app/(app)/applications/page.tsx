import Link from "next/link"
import { Suspense } from "react"
import { MyApplicationsList } from "@/app/(app)/applications/_components/my-applications-list"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { listMyApplications } from "@/lib/api/list-my-applications"

export const metadata = { title: "申請" }

// 自分の申請一覧画面。RSC でサーバ取得し、承認待ちは変更・取り下げ操作付きで表示する。
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

// /applications/me を認証付きで取得して操作付き一覧を描画する非同期 RSC。
async function MyApplicationsTable() {
  const applications = await listMyApplications()

  if (applications instanceof Error) {
    return <p className="text-sm text-destructive">申請一覧の取得に失敗しました</p>
  }

  return <MyApplicationsList applications={applications} />
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
