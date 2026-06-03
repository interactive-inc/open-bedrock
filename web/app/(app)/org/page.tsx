import { Suspense } from "react"
import { OrgDepartmentManagerSection } from "@/app/(app)/org/departments/org-department-manager-section"
import { OrgTreeView } from "@/app/(app)/org/org-tree-view"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "組織" }

// 組織図トップ（部署ツリー /org/tree）。ツリー取得は Suspense 境界で Skeleton をフォールバックにする。
// 部署ノードの作成・変更・削除を行う管理セクションも併せて表示する。
export default function OrgPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">組織図</h1>

      <Suspense fallback={<OrgTreeSkeleton />}>
        <OrgTreeView />
      </Suspense>

      <h2 className="text-xl font-semibold">部署ノードの管理</h2>

      <Suspense fallback={<OrgTreeSkeleton />}>
        <OrgDepartmentManagerSection />
      </Suspense>
    </div>
  )
}

function OrgTreeSkeleton() {
  const placeholders = [0, 1, 2, 3, 4]

  return (
    <div className="flex flex-col gap-2">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-8 w-full" />
      ))}
    </div>
  )
}
