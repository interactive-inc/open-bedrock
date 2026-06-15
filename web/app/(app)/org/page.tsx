import { Suspense } from "react"
import { OrgDepartmentManagerSection } from "@/app/(app)/org/departments/_components/org-department-manager-section"
import { OrgTreeView } from "@/app/(app)/org/_components/org-tree-view"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "組織" }

// 組織図トップ（部署ツリー /org/tree）。ツリー取得は Suspense 境界で Skeleton をフォールバックにする。
// 部署ノードの作成・変更・削除を行う管理セクションも併せて表示する。
export default function OrgPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="組織図" description="部署ツリーの閲覧と、部署ノードの管理を行います。" />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
        <OrgTreeView />
      </Suspense>

      <h2 className="text-xl font-semibold">部署ノードの管理</h2>

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
        <OrgDepartmentManagerSection />
      </Suspense>
    </div>
  )
}
