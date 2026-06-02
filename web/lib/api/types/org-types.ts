// api/src/org の各 schema と同形の手書き type（API と疎結合に保つため再定義）。

// /org/tree の再帰ノード。api/src/org/org-tree-node-schema.ts に対応。
export type OrgTreeNode = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: ReadonlyArray<OrgTreeNode>
}

// /org/departments/:code/members の要素。api/src/org/org-member-response-schema.ts に対応。
export type OrgMember = {
  employee_code: string
  employee_name: string
  position: string | null
  manager_employee_code: string | null
  is_manager: boolean
}

// /org/reporting-line/:employee_code の要素。api/src/org/org-reporting-line-node-schema.ts に対応。
export type OrgReportingLineNode = {
  employee_code: string
  employee_name: string
  department_code: string | null
  position: string | null
  depth: number
}

// /org/departments の要素と /org/departments/:code の詳細。api の OrgDepartment に対応。
export type OrgDepartmentResponse = {
  code: string
  department_id: number
  parent_code: string | null
  manager_employee_code: string | null
  order: number
}

// POST /org/departments のリクエスト本体。
export type OrgDepartmentCreateRequest = {
  code: string
  department_id: number
  parent_code: string | null
  manager_employee_code: string | null
  order: number
}

// PUT /org/departments/:code のリクエスト本体。
export type OrgDepartmentUpdateRequest = {
  parent_code: string | null
  manager_employee_code: string | null
  order: number
}
