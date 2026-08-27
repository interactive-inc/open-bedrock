import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ResignationCreateRequest } from "@/lib/api/types/resignation-types"

/** POST /resignations。退職申請を作成する。status は requested で登録される。 */
export async function createResignation(request: ResignationCreateRequest) {
  const client = await createClient()

  const response = await client["resignation"]["resignations"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "退職申請の作成に失敗しました",
      conflictMessages: {
        "a pending resignation already exists": "審査中の退職申請が既にあります",
      },
    })
  }

  return response.json()
}
