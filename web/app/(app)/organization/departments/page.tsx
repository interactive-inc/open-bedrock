import { Suspense } from "react"
import { OrgDepartmentManagerSection } from "@/app/(app)/organization/departments/_components/org-department-manager-section"
import { OrgTreeView } from "@/app/(app)/organization/departments/_components/org-tree-view"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { canManageOrg } from "@/lib/org/can-manage-org"

export const metadata = { title: "組織" }

/**
 * 組織図トップ（部署ツリー /org/tree）。ツリー取得は Suspense 境界で Skeleton をフォールバックにする。
 * 部署ノードの作成・変更・削除を行う管理セクションも併せて表示する。
 */
export default async function OrgPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageOrg(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="組織図"
        description={
          canManage
            ? "部署ツリーの閲覧と、部署ノードの管理を行います。"
            : "部署ツリーを閲覧します。"
        }
      />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
        <OrgTreeView />
      </Suspense>

      {canManage ? (
        <>
          <h2 className="text-xl font-semibold">部署ノードの管理</h2>

          <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
            <OrgDepartmentManagerSection />
          </Suspense>
        </>
      ) : null}
    </div>
  )
}
