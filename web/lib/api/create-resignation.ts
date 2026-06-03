import { createClient } from "@/lib/api/hc-client"
import type { ResignationCreateRequest } from "@/lib/api/types/resignation-types"

// POST /resignations。退職申請を作成する。status は requested で登録される。
export async function createResignation(request: ResignationCreateRequest) {
  const client = await createClient()

  const response = await client.resignations.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create resignation")
  }

  return response.json()
}
