import type { ApplicationWorkflow } from "@/contexts/company/domain/organization/company-procedure-workflow"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { UnprocessableEntityError } from "@/contexts/company/interface/lib/errors"
import type { Context } from "@/env"

/** Company authorityとして解決できるworkflow selectorだけを許可する。 */
export async function validateApplicationWorkflowReferences(
  context: Context,
  workflow: ApplicationWorkflow,
): Promise<void> {
  const employeeRows = await context.var.database.select({ code: employees.code }).from(employees)
  const employeeCodes = new Set(employeeRows.map((row) => row.code))

  for (const step of workflow.steps) {
    for (const selector of [...step.approvers, ...step.escalation_approvers]) {
      if (selector.type === "role") {
        throw new UnprocessableEntityError(
          "Account role selectors are not Company authority; use a responsibility selector",
        )
      }
      if (selector.type === "employee" && !employeeCodes.has(selector.employee_code)) {
        throw new UnprocessableEntityError(
          `unknown employee in workflow: ${selector.employee_code}`,
        )
      }
    }
  }
}
