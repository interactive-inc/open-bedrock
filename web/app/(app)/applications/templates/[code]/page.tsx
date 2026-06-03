import Link from "next/link"
import { notFound } from "next/navigation"
import { SubmitApplicationForm } from "@/app/(app)/applications/templates/[code]/submit-application-form"
import { TemplateManagement } from "@/app/(app)/applications/templates/template-management"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getApplicationTemplate } from "@/lib/api/get-application-template"
import { getMe } from "@/lib/api/get-me"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"

export const metadata = { title: "申請テンプレート詳細" }

type Props = {
  params: Promise<{ code: string }>
}

// 申請テンプレ詳細 + 提出フォーム画面。RSC でテンプレを取得し、フォームへ渡す。
export default async function ApplicationTemplateDetailPage(props: Props) {
  const params = await props.params

  const template = await getApplicationTemplate(params.code)

  if (template instanceof Error) {
    notFound()
  }

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageApplicationTemplates(currentUser.role)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{template.name}</h1>

          <Badge variant="secondary" className="w-fit">
            {template.category}
          </Badge>
        </div>

        <Button variant="outline" render={<Link href="/applications/templates" />}>
          テンプレ一覧へ
        </Button>
      </div>

      {canManage ? <TemplateManagement template={template} /> : null}

      <Card className="p-0 gap-0">
        <div className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium">説明</span>

          <span className="text-sm text-muted-foreground">
            {template.description ?? "説明なし"}
          </span>
        </div>
      </Card>

      <SubmitApplicationForm templateCode={template.code} />
    </div>
  )
}
