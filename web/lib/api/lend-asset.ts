import { createClient } from "@/lib/api/hc-client"

// POST /assets/:code/lend。物品を従業員へ貸与する（管理者ロールのみ）。
export async function lendAsset(code: string, employeeCode: string) {
  const client = await createClient()

  const response = await client.assets[":code"].lend.$post({
    param: { code },
    json: { employee_code: employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to lend asset")
  }

  return response.json()
}
