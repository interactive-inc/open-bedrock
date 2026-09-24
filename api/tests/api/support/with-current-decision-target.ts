import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { toApplicationDecisionTarget } from "@/api/http/application-requests/lib/to-application-decision-target"

/** 資格テストでは直前に読んだ版を送る。版競合テストが明示した参照は置き換えない。 */
export async function withCurrentDecisionTarget(
  database: D1Database,
  path: string,
  body: unknown,
): Promise<unknown> {
  const match = /^\/company\/application-requests\/(\d+)\/(?:approve|reject)$/.exec(path)
  if (
    match === null ||
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.hasOwn(body, "decision_target")
  )
    return body
  const proposal = await openSystemProposals({ env: { DB: database } }).findByNumber(
    Number(match[1]),
  )
  if (proposal === null || proposal instanceof Error) throw new Error("decision fixture is missing")
  return { ...body, decision_target: toApplicationDecisionTarget(proposal) }
}
