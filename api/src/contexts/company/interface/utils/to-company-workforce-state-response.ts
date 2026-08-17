import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import { toCompanyAssignmentResponse } from "@/contexts/company/interface/utils/to-company-assignment-response"
import { toCompanyResponsibilityResponse } from "@/contexts/company/interface/utils/to-company-responsibility-response"

/** 指定時点のWorkforce stateをorganization revision付き公開表現へ変換する。 */
export function toCompanyWorkforceStateResponse(
  state: WorkforceStateAt,
  organizationRevision: number,
) {
  return {
    employee_id: state.employeeId,
    as_of: state.asOf,
    organization_revision: organizationRevision,
    employment_status: state.status,
    employment_id: state.employmentId,
    primary_assignment:
      state.primaryAssignment === null
        ? null
        : toCompanyAssignmentResponse(state.primaryAssignment),
    concurrent_assignments: state.concurrentAssignments.map(toCompanyAssignmentResponse),
    responsibilities: state.responsibilities.map(toCompanyResponsibilityResponse),
  }
}
