import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

type Props = {
  employeeCode: string
  templateCode: string
}

// POST /onboarding/assign。社員へテンプレートを割り当て、生成された assignment を返す。
export async function postOnboardingAssign(props: Props) {
  const client = await createClient()

  const response = await client.onboarding.assign.$post({
    json: {
      employee_code: props.employeeCode,
      template_code: props.templateCode,
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "オンボーディングの割り当てに失敗しました",
      conflictMessages: {
        "template already assigned to this employee":
          "このテンプレートはこの社員に既に割り当て済みです",
      },
    })
  }

  return response.json()
}
