import { Suspense } from "react"
import { OrgTreeView } from "@/app/(app)/org/org-tree-view"
import { Skeleton } from "@/components/ui/skeleton"

// 組織図トップ（部署ツリー /org/tree）。ツリー取得は Suspense 境界で Skeleton をフォールバックにする。
export default function OrgPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">組織図</h1>

      <Suspense fallback={<OrgTreeSkeleton />}>
        <OrgTreeView />
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
