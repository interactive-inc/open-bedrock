import type { DepartmentTreeNode } from "@/domain/org/department-tree-node"
import type { OrgDepartment } from "@/domain/org/org-department"

export type Props = {
  departments: ReadonlyArray<OrgDepartment>
  departmentNamesByCode: ReadonlyMap<string, string>
  memberCountsByCode: ReadonlyMap<string, number>
}

// 親子関係と order から部署ツリーを再帰的に組む純粋関数。
export function buildDepartmentTree(props: Props): ReadonlyArray<DepartmentTreeNode> {
  const departmentsByParent = new Map<string, Array<OrgDepartment>>()

  const rootDepartments: Array<OrgDepartment> = []

  for (const department of props.departments) {
    if (department.parentCode === null) {
      rootDepartments.push(department)

      continue
    }

    const siblings = departmentsByParent.get(department.parentCode) ?? []

    siblings.push(department)

    departmentsByParent.set(department.parentCode, siblings)
  }

  return buildChildren({
    siblings: rootDepartments,
    departmentsByParent,
    departmentNamesByCode: props.departmentNamesByCode,
    memberCountsByCode: props.memberCountsByCode,
  })
}

type ChildrenProps = {
  siblings: ReadonlyArray<OrgDepartment>
  departmentsByParent: ReadonlyMap<string, ReadonlyArray<OrgDepartment>>
  departmentNamesByCode: ReadonlyMap<string, string>
  memberCountsByCode: ReadonlyMap<string, number>
}

function buildChildren(props: ChildrenProps): ReadonlyArray<DepartmentTreeNode> {
  const sorted = Array.from(props.siblings).sort((a, b) => a.order - b.order)

  return sorted.map((department) => ({
    department,
    name: props.departmentNamesByCode.get(department.code) ?? "",
    memberCount: props.memberCountsByCode.get(department.code) ?? 0,
    children: buildChildren({
      siblings: props.departmentsByParent.get(department.code) ?? [],
      departmentsByParent: props.departmentsByParent,
      departmentNamesByCode: props.departmentNamesByCode,
      memberCountsByCode: props.memberCountsByCode,
    }),
  }))
}
