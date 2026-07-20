import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { DocumentUpdateRequest } from "@/lib/api/types/document-types"

/** PUT /documents/:id。文書台帳のメタデータを更新する（document:manage）。 */
export async function updateDocument(id: number, request: DocumentUpdateRequest) {
  const client = await createClient()

  const response = await client.documents[":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "文書の更新に失敗しました" })
  }

  return response.json()
}
