import { isOrganizationalAuthorityStateEligible } from "@/contexts/company/domain/workforce/is-organizational-authority-state-eligible"
import type { OrganizationalAuthorityError } from "@/contexts/company/domain/workforce/organizational-authority-error"
import type {
  OrganizationalAuthorityCandidate,
  OrganizationalAuthorityProjection,
  OrganizationalAuthorityResolution,
} from "@/contexts/company/domain/workforce/organizational-authority"
import { resolveOrganizationalAuthorityCriterion } from "@/contexts/company/domain/workforce/resolve-organizational-authority-criterion"
import { validateOrganizationalAuthorityProjection } from "@/contexts/company/domain/workforce/validate-organizational-authority-projection"
import type { AccountEmployeeLink } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

/** Companyの固定済みWorkforce projectionだけから組織上の判断候補を解決する。 */
export function resolveOrganizationalAuthority(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityResolution | OrganizationalAuthorityError {
  const projectionError = validateOrganizationalAuthorityProjection(projection)
  if (projectionError !== null) return projectionError

  const statesByEmployee = new Map(projection.states.map((state) => [state.employeeId, state]))
  const linksByEmployee = new Map<EmployeeId, AccountEmployeeLink>()
  for (const link of projection.accountLinks) linksByEmployee.set(link.employeeId, link)
  const candidates: OrganizationalAuthorityCandidate[] = []

  for (const [criterionIndex, criterion] of projection.criteria.entries()) {
    for (const candidate of resolveOrganizationalAuthorityCriterion({
      criterion,
      statesByEmployee,
      subjectEmployeeId: projection.subjectEmployeeId,
      asOf: projection.snapshot.asOf,
    })) {
      if (candidate.employeeId === projection.subjectEmployeeId) continue
      const state = statesByEmployee.get(candidate.employeeId)
      const link = linksByEmployee.get(candidate.employeeId)
      if (
        state === undefined ||
        !isOrganizationalAuthorityStateEligible(state) ||
        link === undefined
      ) {
        continue
      }

      candidates.push({
        employeeId: candidate.employeeId,
        accountId: link.accountId,
        qualification: { criterionIndex, evidence: candidate.evidence },
      })
    }
  }

  return { snapshot: projection.snapshot, candidates }
}
