import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { DepartmentDefinitionCreateRequest } from "@/lib/api/types/department-definition-types"

/**
 * POST /department-definitions。部署マスタを新規作成する。
 * 戻りは作成された部署マスタ or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createDepartmentDefinition(request: DepartmentDefinitionCreateRequest) {
  const client = await createClient()

  const response = await client["department-definitions"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "部署マスタの作成に失敗しました",
      conflictMessages: {
        "department name already exists": "同じ名前の部署マスタが既にあります",
      },
    })
  }

  return response.json()
}
