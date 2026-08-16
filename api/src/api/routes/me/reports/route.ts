import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { InternalError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppMyReportList } from "@/lib/app-schemas"
import { loadCurrentOrganization } from "@/contexts/company/application/organization/current-organization-read-model"

// @authorization owner - 本人のリソースに限定する
/**
 * GET /me/reports — 本人が manager である直属部下の在籍中(active)一覧。
 * 認証のみで permission 不要（自分の配下という関係そのもの）。配下なしは空配列。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const organization = await loadCurrentOrganization(c)
  if (organization instanceof Error) throw new InternalError("failed to load organization")

  const viewer = [...organization.employeesByCode.values()].find(
    (employee) => employee.id === session.employeeId,
  )

  if (viewer === undefined) {
    return c.json(zAppMyReportList.parse({ data: [] }), 200)
  }

  const departmentNameByCode = new Map(
    organization.departments.map((department) => [department.code, department.name] as const),
  )

  const reports = [...organization.employeesByCode.values()]
    .filter((employee) => {
      if (employee.status !== "active") return false

      return employee.assignments.some(
        (assignment) => assignment.managerEmployeeCode === viewer.code,
      )
    })
    .sort((left, right) => left.code.localeCompare(right.code))
    .map((employee) => ({
      code: employee.code,
      name: employee.name,
      dept_name:
        employee.primaryDepartmentCode === null
          ? null
          : (departmentNameByCode.get(employee.primaryDepartmentCode) ?? null),
      position: employee.position,
    }))

  return c.json(zAppMyReportList.parse({ data: reports }), 200)
})
