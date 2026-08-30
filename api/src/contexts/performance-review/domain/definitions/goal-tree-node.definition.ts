import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type GoalTreeNode = {
  id: number
  employee_id: EmployeeId
  period: string
  title: string
  kpi: string | null
  weight: number
  status: string
  owner_type: "individual" | "department" | "company"
  parent_goal_id: number | null
  department_code: string | null
  children: ReadonlyArray<GoalTreeNode>
}
