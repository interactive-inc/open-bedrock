import { createClient } from "@/lib/api/hc-client"

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
    return new Error("failed to assign onboarding")
  }

  return response.json()
}
