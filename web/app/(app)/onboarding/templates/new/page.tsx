import { notFound } from "next/navigation"
import { CreateTemplateForm } from "@/app/(app)/onboarding/_components/create-template-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"

export const metadata = { title: "オンボーディングテンプレートの作成" }

/**
 * オンボーディングテンプレートの新規作成（特権ロールのみ）。
 */
export default async function NewOnboardingTemplatePage() {
  const me = await getMe()

  if (me instanceof Error || !canManageOnboarding(me.role)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="テンプレートを作成"
        description="入社・退社のオンボーディングタスクをテンプレートに登録します。"
        actions={<BackButton href="/onboarding" label="一覧に戻る" />}
      />

      <Card className="max-w-xl">
        <CardContent>
          <CreateTemplateForm />
        </CardContent>
      </Card>
    </div>
  )
}
