import { buildDepartmentTree } from "@/lib/org/build-department-tree"
import type { DepartmentTreeNode } from "@/lib/org/department-tree-node"
import { OrgDepartment } from "@/domain/org/org-department.entity"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { MAX_ORG_NODES } from "@/interface/shared/to-bounded-int"
import { zAppOrgTreeList } from "@/lib/app-schemas"
import type { AppOrgTreeNode } from "@/lib/app-schemas"
import { departments, orgDepartments, orgMemberships } from "@/schema"
import { count, eq } from "drizzle-orm"

function toOrgTreeNode(node: DepartmentTreeNode): AppOrgTreeNode {
  return {
    code: node.department.code,
    name: node.name,
    manager_employee_code: node.department.managerEmployeeCode,
    member_count: node.memberCount,
    children: node.children.map(toOrgTreeNode),
  }
}

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const departmentRows = await c.var.database
    .select({ orgDepartment: orgDepartments, name: departments.name })
    .from(orgDepartments)
    .leftJoin(departments, eq(departments.id, orgDepartments.departmentId))
    .limit(MAX_ORG_NODES + 1)

  if (departmentRows.length > MAX_ORG_NODES) {
    console.warn(`[org] department tree exceeded ${MAX_ORG_NODES} nodes; response truncated`)
  }

  const boundedDepartmentRows = departmentRows.slice(0, MAX_ORG_NODES)

  const countRows = await c.var.database
    .select({ departmentCode: orgMemberships.departmentCode, total: count() })
    .from(orgMemberships)
    .groupBy(orgMemberships.departmentCode)

  const namesByCode = new Map<string, string>()

  const countsByCode = new Map<string, number>()

  for (const row of countRows) {
    countsByCode.set(row.departmentCode, row.total)
  }

  const orgDepartmentEntities = boundedDepartmentRows.map((row) => {
    namesByCode.set(row.orgDepartment.code, row.name ?? "")

    return new OrgDepartment({
      code: row.orgDepartment.code,
      departmentId: row.orgDepartment.departmentId,
      parentCode: row.orgDepartment.parentCode,
      managerEmployeeCode: row.orgDepartment.managerEmployeeCode,
      order: row.orgDepartment.sortOrder,
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
