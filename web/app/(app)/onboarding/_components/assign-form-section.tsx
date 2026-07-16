import { FetchError } from "@/components/fetch-error"
import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { getOnboardingTemplates } from "@/lib/api/get-onboarding-templates"
import { AssignForm } from "@/app/(app)/onboarding/_components/assign-form"

// 割当フォームへテンプレート・従業員の選択肢を供給する非同期 RSC ラッパー。
export async function AssignFormSection() {
  const templates = await getOnboardingTemplates(null)

  if (templates instanceof Error) {
    return <FetchError message="テンプレートの取得に失敗しました" />
  }

  const employeeResult = await getEmployeeDirectory()

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.map((e) => ({ code: e.code, name: e.name }))

  return <AssignForm templates={templates} employees={employees} />
}
