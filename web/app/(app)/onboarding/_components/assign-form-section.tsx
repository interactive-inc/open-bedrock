import { FetchError } from "@/components/fetch-error"
import { getOnboardingTemplates } from "@/lib/api/get-onboarding-templates"
import { AssignForm } from "@/app/(app)/onboarding/_components/assign-form"

// 割当フォームへテンプレート選択肢を供給する非同期 RSC ラッパー。
// テンプレート取得に失敗した場合はフォームを出さずエラーを表示する。
export async function AssignFormSection() {
  const templates = await getOnboardingTemplates(null)

  if (templates instanceof Error) {
    return <FetchError message="テンプレートの取得に失敗しました" />
  }

  return <AssignForm templates={templates} />
}
