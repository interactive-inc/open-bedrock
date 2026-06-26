import { AccountListSection } from "@/app/(app)/admin/accounts/_components/account-list-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Suspense } from "react"

export const metadata = { title: "アカウント管理" }

// アカウント管理画面。従業員に紐づくアカウントと割当ロール・状態を一覧する（account:manage が必要）。
export default function AdminAccountsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="アカウント管理"
        description="アカウントの状態と割り当てられたロールを管理します。"
      />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <AccountListSection />
      </Suspense>
    </div>
  )
}
