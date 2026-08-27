import { Plus } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { OrgDepartmentManagerSection } from "@/app/(app)/organization/departments/_components/org-department-manager-section"
import { OrgChartView } from "@/app/(app)/organization/departments/_components/org-chart-view"
import { OrgTreeView } from "@/app/(app)/organization/departments/_components/org-tree-view"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMe } from "@/lib/api/get-me"
import { canManageOrg } from "@/lib/org/can-manage-org"

export const metadata = { title: "組織" }

/**
 * 組織図トップ。「組織図」（部署→マネージャー→従業員の縦型ボックス）と「リスト」（インデント式一覧）を
 * タブで切り替える。部署ノードの作成・変更・削除を行う管理セクションも併せて表示する。
 */
export default async function OrgPage() {
  const currentUser = await getMe()

  const canManage = currentUser instanceof Error ? false : canManageOrg(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="組織図"
        description={
          canManage ? "組織図の閲覧と、部署ノードの管理を行います。" : "組織図を閲覧します。"
        }
      />

      <Tabs defaultValue="chart">
        <TabsList>
          <TabsTrigger value="chart">組織図</TabsTrigger>
          <TabsTrigger value="list">リスト</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4">
          <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
            <OrgChartView />
          </Suspense>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
            <OrgTreeView />
          </Suspense>
        </TabsContent>
      </Tabs>

      {canManage ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">部署ノードの管理</h2>

            <div className="flex items-center gap-2">
              <Button nativeButton={false} render={<Link href="/organization/departments/new" />}>
                <Plus />
                新規部署
              </Button>
            </div>
          </div>

          <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-8 w-full" />}>
            <OrgDepartmentManagerSection />
          </Suspense>
        </>
      ) : null}
    </div>
  )
}
