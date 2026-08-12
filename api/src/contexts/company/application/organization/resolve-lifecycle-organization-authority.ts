import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { LifecycleOrganizationGraph } from "@/contexts/company/infrastructure/organization/lifecycle-organization-graph"
import type { OrganizationAuthority } from "@/contexts/company/domain/organization/organization-authority"

/**
 * ライフサイクル投影ベースで actor が target に対して持つ管理関係を解決する。
 */
export async function resolveLifecycleOrganizationAuthority(
  c: Context,
  actorEmployeeId: number,
  targetEmployeeId: number,
  asOf?: string,
): Promise<OrganizationAuthority | ApplicationError> {
  const graph = await LifecycleOrganizationGraph.load(c, asOf)
  if (graph instanceof ApplicationError) return graph
  return graph.authorityFor(actorEmployeeId, targetEmployeeId)
}
