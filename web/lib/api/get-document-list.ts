import { createClient } from "@/lib/api/hc-client"

/** GET /document-ledger-entries。文書台帳一覧（期限の近い順）。document:read:all が無いと 403。 */
export async function getDocumentList(query: { category: string | null }) {
  const client = await createClient()

  const response = await client["document"]["document-ledger-entries"].$get({
    query: { category: query.category ?? undefined },
  })

  if (!response.ok) {
    return new Error("failed to load documents")
  }

  const body = await response.json()

  return body.data
}
