import Link from "next/link"
import { Suspense } from "react"
import { CreateTemplateForm } from "@/app/(app)/applications/templates/create-template-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getApplicationTemplates } from "@/lib/api/get-application-templates"
import { getMe } from "@/lib/api/get-me"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"

export const metadata = { title: "申請テンプレート" }

// 申請テンプレ一覧画面。カード表示し、各テンプレ詳細へ遷移できる。
// 管理権限にはテンプレート作成フォームを追加で表示する。
export default async function ApplicationTemplatesPage() {
  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageApplicationTemplates(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">申請テンプレート</h1>

        <Button variant="outline" render={<Link href="/applications" />}>
          申請一覧へ
        </Button>
      </div>

      <Suspense fallback={<TemplatesSkeleton />}>
        <TemplatesGrid />
      </Suspense>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>テンプレートを作成</CardTitle>
          </CardHeader>

          <CardContent>
            <CreateTemplateForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// /templates を認証付きで取得してカードグリッドを描画する非同期 RSC。
async function TemplatesGrid() {
  const templates = await getApplicationTemplates(null)

  if (templates instanceof Error) {
    return <p className="text-sm text-destructive">テンプレートの取得に失敗しました</p>
  }

  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">利用可能なテンプレートがありません</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.code} className="p-0 gap-0">
          <Link
            href={`/applications/templates/${template.code}`}
            className="flex flex-col gap-3 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{template.name}</span>

              <Badge variant="secondary">{template.category}</Badge>
            </div>

            <span className="text-sm text-muted-foreground">
              {template.description ?? "説明なし"}
            </span>
          </Link>
        </Card>
      ))}
    </div>
  )
}

function TemplatesSkeleton() {
  const placeholders = [0, 1, 2, 3, 4, 5]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {placeholders.map((index) => (
        <Skeleton key={index} className="h-32 w-full" />
      ))}
    </div>
  )
}
