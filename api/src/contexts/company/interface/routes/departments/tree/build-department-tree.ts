import type { DepartmentTreeNode } from "@/contexts/company/interface/routes/departments/tree/department-tree-node"
import type { OrgDepartment } from "@/contexts/company/domain/organization/org-department.entity"

export type Props = {
  departments: ReadonlyArray<OrgDepartment>
  departmentNamesByCode: ReadonlyMap<string, string>
  memberCountsByCode: ReadonlyMap<string, number>
}

/**
 * 親子関係と order から部署ツリーを再帰的に組む純粋関数。
 * visited ガードにより、既存データに循環がある場合でも無限再帰しない。
 */
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
    visited: new Set(),
  })
}

type ChildrenProps = {
  siblings: ReadonlyArray<OrgDepartment>
  departmentsByParent: ReadonlyMap<string, ReadonlyArray<OrgDepartment>>
  departmentNamesByCode: ReadonlyMap<string, string>
  memberCountsByCode: ReadonlyMap<string, number>
  visited: Set<string>
}

function buildChildren(props: ChildrenProps): ReadonlyArray<DepartmentTreeNode> {
  const sorted = Array.from(props.siblings).sort((a, b) => a.order - b.order)

  return sorted
    .filter((department) => !props.visited.has(department.code))
    .map((department) => {
      props.visited.add(department.code)

      return {
        department,
        name: props.departmentNamesByCode.get(department.code) ?? "",
        memberCount: props.memberCountsByCode.get(department.code) ?? 0,
        children: buildChildren({
          siblings: props.departmentsByParent.get(department.code) ?? [],
          departmentsByParent: props.departmentsByParent,
          departmentNamesByCode: props.departmentNamesByCode,
          memberCountsByCode: props.memberCountsByCode,
          visited: props.visited,
        }),
      }
    })
}
