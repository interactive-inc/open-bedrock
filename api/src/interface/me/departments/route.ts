import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zAppMyDepartmentList } from "@/lib/app-schemas"
import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"

// GET /me/departments — 本人が現に所属する部署の一覧（主配属を先頭、以降は兼務）。
// 認証のみで permission 不要（自分の所属という関係そのもの）。所属なしは空配列。
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
    return c.json(zAppMyDepartmentList.parse({ data: [] }), 200)
  }

  const departmentNameByCode = new Map(
    organization.departments.map((department) => [department.code, department.name] as const),
  )

  const myDepartments = [...viewer.assignments]
    .sort((left, right) => {
      if (left.assignmentType !== right.assignmentType) {
        return left.assignmentType === "primary" ? -1 : 1
      }

      return left.departmentCode.localeCompare(right.departmentCode)
    })
    .flatMap((assignment) => {
      const name = departmentNameByCode.get(assignment.departmentCode)

      if (name === undefined) {
        return []
      }

      return [
        {
          code: assignment.departmentCode,
          name,
          assignment_type: assignment.assignmentType,
        },
      ]
    })

  return c.json(zAppMyDepartmentList.parse({ data: myDepartments }), 200)
})
