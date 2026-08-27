import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { DocumentRegisterRequest } from "@/lib/api/types/document-types"

/** POST /document-ledger-entries。文書台帳へメタデータを登録する（document:manage）。 */
export async function registerDocument(request: DocumentRegisterRequest) {
  const client = await createClient()

  const response = await client["document"]["document-ledger-entries"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "文書の登録に失敗しました" })
  }

  return response.json()
}
