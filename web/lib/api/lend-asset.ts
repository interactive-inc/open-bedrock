import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /assets/:code/lend。物品を従業員へ貸与する（管理者ロールのみ）。 */
export async function lendAsset(code: string, employeeCode: string) {
  const client = await createClient()

  const response = await client["asset"]["assets"][":code"].lend.$post({
    param: { code },
    json: { employee_code: employeeCode },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "物品の貸与に失敗しました",
      conflictMessages: {
        "asset is not in stock": "この物品は在庫にないため貸与できません",
      },
    })
  }

  return response.json()
}
