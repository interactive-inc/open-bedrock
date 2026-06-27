import { Suspense } from "react"
import { OrgDepartmentManagerSection } from "@/app/(app)/org/departments/_components/org-department-manager-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "部署" }

// 部署管理ページ。部署ノードの作成・変更・削除を行う（org:manage が必要）。
// 組織図ツリーは /org（概要）で閲覧する。
export default function OrgDepartmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="部署" description="部署ノードの作成・変更・削除を行います。" />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
        <OrgDepartmentManagerSection />
      </Suspense>
    </div>
  )
}
