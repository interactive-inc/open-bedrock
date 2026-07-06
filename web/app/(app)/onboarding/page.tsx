import { ClipboardList, FileText, Plus, User } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageOnboarding } from "@/lib/onboarding/can-manage-onboarding"

export const metadata = { title: "オンボーディング" }

/**
 * オンボーディングのハブ画面（特権ロールのみ）。テンプレート・割当・自分のタスクへの入口をまとめる。
 */
export default async function OnboardingPage() {
  const me = await getMe()

  if (me instanceof Error || !canManageOnboarding(me.permissions)) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="オンボーディング"
        description="テンプレートを管理し、社員へ割り当てます。"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/onboarding/me" />}>
            <User />
            自分のタスク
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              テンプレート
            </CardTitle>

            <CardDescription>
              入社・退社のオンボーディングテンプレートを管理します。
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/onboarding/templates" />}
            >
              テンプレート一覧
            </Button>

            <Button nativeButton={false} render={<Link href="/onboarding/templates/new" />}>
              <Plus />
              新規テンプレート
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-4" />
              割当
            </CardTitle>

            <CardDescription>社員へテンプレートを割り当てます。</CardDescription>
          </CardHeader>

          <CardContent className="flex flex-wrap gap-2">
            <Button nativeButton={false} render={<Link href="/onboarding/assignments/new" />}>
              <Plus />
              新規割当
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
