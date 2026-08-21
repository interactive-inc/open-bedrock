import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { validateCodeParam } from "@/lib/http/validate-code-param"
import { zAppOrgReportingLineList } from "@/lib/app-schemas"
import type { AppOrgReportingLineNode } from "@/lib/app-schemas"
import { loadCurrentOrganization } from "@/contexts/company/infrastructure/organization/current-organization-read-model.repository"

// @authorization authenticated - ログインしていれば誰でも読める共有データ
/** GET /employees/:code/reporting-line — 本人から上位へのレポートライン */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const employeeCode = validateCodeParam(c.req.param("code"), "employee")

  const organization = await loadCurrentOrganization(c)
  if (organization instanceof Error) throw new InternalError("failed to load organization")
  const entry = organization.employeesByCode.get(employeeCode)

  if (entry === undefined || entry.primaryDepartmentCode === null) {
    throw new NotFoundError("membership not found")
  }

  const body: Array<AppOrgReportingLineNode> = []

  const visited = new Set<string>()

  let currentCode: string | null = employeeCode

  while (currentCode !== null && visited.has(currentCode) === false) {
    const row = organization.employeesByCode.get(currentCode)

    if (row === undefined || row.primaryDepartmentCode === null) {
      break
    }

    visited.add(currentCode)

    body.push({
      employee_code: currentCode,
      employee_name: row.name,
      department_code: row.primaryDepartmentCode,
      position: row.position,
      depth: body.length,
    })

    currentCode = row.managerEmployeeCode
  }

  const responseBody = zAppOrgReportingLineList.parse(body)

  return c.json(responseBody, 200)
})
