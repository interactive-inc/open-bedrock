import { Suspense } from "react"
import { DepartmentDefinitionCreateForm } from "@/app/(app)/organization/departments/definitions/_components/department-definition-create-form"
import { DepartmentDefinitionList } from "@/app/(app)/organization/departments/definitions/_components/department-definition-list"
import { BackButton } from "@/components/back-button"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getDepartmentDefinitionList } from "@/lib/api/get-department-definition-list"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "部署マスタ" }

/**
 * 部署マスタ管理画面。マスタ（id と名称）の一覧と新規登録を行う（org:manage が必要）。
 * 組織図への配置は部署ノードの作成（/organization/departments/new）で行う。
 */
export default async function DepartmentDefinitionsPage() {
  await requirePermission("org:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="部署マスタ"
        description="部署の名称マスタを管理します。組織図への配置は部署ノードの作成から行います。"
        actions={<BackButton href="/organization/departments" label="組織図に戻る" />}
      />

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <DepartmentDefinitions />
      </Suspense>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>部署マスタを作成</CardTitle>
        </CardHeader>

        <CardContent>
          <DepartmentDefinitionCreateForm />
        </CardContent>
      </Card>
    </div>
  )
}

async function DepartmentDefinitions() {
  const departmentDefinitions = await getDepartmentDefinitionList()

  if (departmentDefinitions instanceof Error) {
    return <FetchError message="部署マスタの取得に失敗しました" />
  }

  return <DepartmentDefinitionList departmentDefinitions={departmentDefinitions} />
}
