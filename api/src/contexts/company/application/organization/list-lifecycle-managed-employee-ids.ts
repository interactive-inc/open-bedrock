import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"
import { LifecycleOrganizationGraph } from "@/contexts/company/infrastructure/organization/lifecycle-organization-graph"

/**
 * ライフサイクル投影ベースで actor が管理できる社員IDを返す。受信箱の絞り込みに使う。
 */
export async function listLifecycleManagedEmployeeIds(
  c: Context,
  actorEmployeeId: number,
  asOf?: string,
): Promise<ReadonlyArray<number> | ApplicationError> {
  const graph = await LifecycleOrganizationGraph.load(c, asOf)
  if (graph instanceof ApplicationError) return graph
  return graph.managedEmployeeIds(actorEmployeeId)
}
