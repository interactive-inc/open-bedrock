import { compareOrganizationalAuthorityAssignments } from "@/contexts/company/domain/policies/compare-organizational-authority-assignments.policy"
import { listWorkforceStateAssignments } from "@/contexts/company/domain/definitions/list-workforce-state-assignments.definition"
import type { OrganizationalAuthorityCandidateEvidence } from "@/contexts/company/domain/definitions/organizational-authority-candidate-evidence.definition"
import type {
  OrganizationalAuthorityManagementEdgeEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import { toOrganizationalAuthorityManagementEdgeEvidence } from "@/contexts/company/domain/policies/to-organizational-authority-management-edge-evidence.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function listOrganizationalAuthorityManagementChainCandidates(props: {
  statesByEmployee: ReadonlyMap<EmployeeId, WorkforceStateAt>
  subjectEmployeeId: EmployeeId
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"]
}): ReadonlyArray<OrganizationalAuthorityCandidateEvidence> {
  const edgesByEmployee = new Map<
    EmployeeId,
    ReadonlyArray<OrganizationalAuthorityManagementEdgeEvidence>
  >()
  for (const state of props.statesByEmployee.values()) {
    const managementEdges: OrganizationalAuthorityManagementEdgeEvidence[] = []
    for (const assignment of listWorkforceStateAssignments(state).toSorted(
      compareOrganizationalAuthorityAssignments,
    )) {
      if (assignment.managerEmployeeId === null) continue
      managementEdges.push(
        toOrganizationalAuthorityManagementEdgeEvidence(
          assignment,
          assignment.managerEmployeeId,
          props.asOf,
        ),
      )
    }
    edgesByEmployee.set(state.employeeId, managementEdges)
  }

  const pending = (edgesByEmployee.get(props.subjectEmployeeId) ?? []).map((edge) => ({
    employeeId: edge.managerEmployeeId,
    path: [edge],
  }))
  const visited = new Set<EmployeeId>([props.subjectEmployeeId])
  const candidates: OrganizationalAuthorityCandidateEvidence[] = []

  while (pending.length > 0) {
    const current = pending.shift()
    if (current === undefined) break
    if (visited.has(current.employeeId)) continue
    visited.add(current.employeeId)
    candidates.push({
      employeeId: current.employeeId,
      evidence: { kind: "management_chain", path: current.path },
    })
    pending.push(
      ...(edgesByEmployee.get(current.employeeId) ?? []).map((edge) => ({
        employeeId: edge.managerEmployeeId,
        path: [...current.path, edge],
      })),
    )
  }

  return candidates
}
