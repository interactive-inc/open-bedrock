import { buildDepartmentTree } from "@/domain/org/build-department-tree"
import type { DepartmentTreeNode } from "@/domain/org/department-tree-node"
import { OrgDepartment } from "@/domain/org/org-department"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { UnauthorizedError } from "@/interface/lib/errors"
import { departments, orgDepartments, orgMemberships } from "@/schema"
import { count, eq } from "drizzle-orm"

type OrgTreeNode = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: ReadonlyArray<OrgTreeNode>
}

function toOrgTreeNode(node: DepartmentTreeNode): OrgTreeNode {
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

  const countRows = await c.var.database
    .select({ departmentCode: orgMemberships.departmentCode, total: count() })
    .from(orgMemberships)
    .groupBy(orgMemberships.departmentCode)

  const namesByCode = new Map<string, string>()

  const countsByCode = new Map<string, number>()

  for (const row of countRows) {
    countsByCode.set(row.departmentCode, row.total)
  }

  const orgDepartmentEntities = departmentRows.map((row) => {
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

  const body = tree.map(toOrgTreeNode)

  return c.json(body, 200)
})
