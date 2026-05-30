import { getOnboardingTemplates } from "@/lib/api/get-onboarding-templates"
import { AssignForm } from "@/app/(app)/onboarding/assign-form"

// 割当フォームへテンプレート選択肢を供給する非同期 RSC ラッパー。
// テンプレート取得に失敗した場合はフォームを出さずエラーを表示する。
export async function AssignFormSection() {
  const templates = await getOnboardingTemplates(null)

  if (templates instanceof Error) {
    return <p className="text-sm text-destructive">テンプレートの取得に失敗しました</p>
  }

  return <AssignForm templates={templates} />
}
