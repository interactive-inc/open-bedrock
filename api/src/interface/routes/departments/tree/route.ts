import { buildDepartmentTree } from "@/interface/routes/departments/tree/build-department-tree"
import type { DepartmentTreeNode } from "@/interface/routes/departments/tree/department-tree-node"
import { OrgDepartment } from "@/domain/org/org-department.entity"
import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { MAX_ORG_NODES } from "@/interface/utils/to-bounded-int"
import { zAppOrgTreeList } from "@/lib/app-schemas"
import type { AppOrgTreeNode } from "@/lib/app-schemas"
import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"
import { InternalError } from "@/interface/lib/errors"

function toOrgTreeNode(node: DepartmentTreeNode): AppOrgTreeNode {
  return {
    code: node.department.code,
    name: node.name,
    manager_employee_code: node.department.managerEmployeeCode,
    member_count: node.memberCount,
    children: node.children.map(toOrgTreeNode),
  }
}

// @authorization authenticated - ログインしていれば誰でも読める共有データ
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const organization = await loadCurrentOrganization(c)
  if (organization instanceof Error) throw new InternalError("failed to load organization")
  const departmentRows = organization.departments

  if (departmentRows.length > MAX_ORG_NODES) {
    console.warn(`[org] department tree exceeded ${MAX_ORG_NODES} nodes; response truncated`)
  }

  const boundedDepartmentRows = departmentRows.slice(0, MAX_ORG_NODES)

  const namesByCode = new Map<string, string>()
  const countsByCode = new Map<string, number>()
  for (const employee of organization.employeesByCode.values()) {
    for (const departmentCode of employee.departmentCodes) {
      countsByCode.set(departmentCode, (countsByCode.get(departmentCode) ?? 0) + 1)
    }
  }

  const orgDepartmentEntities = boundedDepartmentRows.map((row) => {
    namesByCode.set(row.code, row.name)

    return new OrgDepartment({
      code: row.code,
      departmentId: row.departmentId,
      parentCode: row.parentCode,
      managerEmployeeCode: organization.managerByDepartmentCode.get(row.code) ?? null,
      order: row.order,
    })
  })

  const tree = buildDepartmentTree({
    departments: orgDepartmentEntities,
    departmentNamesByCode: namesByCode,
    memberCountsByCode: countsByCode,
  })

  const responseBody = zAppOrgTreeList.parse(tree.map(toOrgTreeNode))

  return c.json(responseBody, 200)
})
