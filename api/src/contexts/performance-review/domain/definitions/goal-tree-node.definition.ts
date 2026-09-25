import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type GoalTreeNode = {
  id: string
  employee_id: EmployeeId
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
  owner_type: "individual" | "department" | "company"
  parent_goal_id: string | null
  department_code: string | null
  children: ReadonlyArray<GoalTreeNode>
}
