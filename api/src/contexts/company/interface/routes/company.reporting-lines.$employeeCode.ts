/** /company/reporting-lines/:employeeCode */
import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyReportingLineNotFoundError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - company:read capabilityで報告ラインを読む
export const GET = factory.createHandlers(
  zValidator(
    "param",
    z.object({ employeeCode: z.string().trim().min(1).max(64) }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (!actor.hasCapability("company:read")) throw new CompanyReadForbiddenError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()

    const organization = await new CurrentOrganizationReadModelAdapter({
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        ...(context.var.companyClock === undefined
          ? {}
          : { NOW: context.var.companyClock().toISOString() }),
      },
      var: { database: context.var.database, auditContext: context.var.auditContext },
    }).loadCurrentOrganization()
    if (organization instanceof Error) throw new CompanyReadUnavailableError(organization)
    const employeeCode = context.req.valid("param").employeeCode
    const employee = organization.employeesByCode.get(employeeCode)
    if (employee === undefined || employee.primaryDepartmentCode === null) {
      throw new CompanyReportingLineNotFoundError()
    }

    const nodes: Array<{
      employee_code: string
      employee_name: string
      department_code: string
      position: string | null
      depth: number
    }> = []
    const visited = new Set<string>()
    let currentCode: string | null = employeeCode
    while (currentCode !== null && !visited.has(currentCode)) {
      const current = organization.employeesByCode.get(currentCode)
      if (current === undefined || current.primaryDepartmentCode === null) break
      visited.add(currentCode)
      nodes.push({
        employee_code: current.code,
        employee_name: current.name,
        department_code: current.primaryDepartmentCode,
        position: current.position,
        depth: nodes.length,
      })
      currentCode = current.managerEmployeeCode
    }

    return context.json(nodes, 200)
  },
)
