import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function archiveEmployee(code: string): Promise<null | Error> {
  const client = await createClient()
  const response = await client.employees[":code"].archive.$post({ param: { code } })
  if (!response.ok) {
    return toResponseError(response, {
      fallback: "従業員のアーカイブに失敗しました",
      conflictMessages: {
        退職済みの従業員だけをアーカイブできます: "退職が確定した従業員だけをアーカイブできます",
      },
    })
  }
  return null
}
