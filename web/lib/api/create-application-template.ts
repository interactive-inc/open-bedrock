import { createClient } from "@/lib/api/hc-client"
import type {
  ApplicationTemplateCreateRequest,
  ApplicationTemplateResponse,
} from "@/lib/api/types/application-template-types"

// POST /application-templates。管理権限が申請テンプレートを作成する。
export async function createApplicationTemplate(
  request: ApplicationTemplateCreateRequest,
): Promise<ApplicationTemplateResponse | Error> {
  const client = await createClient()

  const response = await client["application-templates"].$post({
    json: {
      code: request.code,
      name: request.name,
      category: request.category,
      description: request.description ?? undefined,
      schema_json: request.schema_json,
      approver_roles: [...request.approver_roles],
    },
  })

  if (response.status >= 400) {
    return new Error("failed to create application template")
  }

  return response.json()
}
