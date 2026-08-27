import { createClient } from "@/lib/api/hc-client"
import type { ContractSearchQuery } from "@/lib/api/types/contract-types"

/**
 * GET /partner-contracts。契約記録一覧（contract:read:all）。partner_id で絞り込み、order で並べ替える。
 * 閲覧権限がない場合 api は 403 を返すため、戻りは Error になる。
 */
export async function getContractList(query: ContractSearchQuery) {
  const client = await createClient()

  const response = await client["partner"]["partner-contracts"].$get({
    query: {
      partner_id: query.partnerId === null ? undefined : String(query.partnerId),
      order: query.order ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load contracts")
  }

  const body = await response.json()

  return body.data
}
