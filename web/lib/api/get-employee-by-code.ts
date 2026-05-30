import { getEmployeeList } from "@/lib/api/get-employee-list"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

// 単一従業員取得。api に詳細エンドポイントが無いため、
// GET /employees の結果から code 一致を探す（見つからなければ null）。
export async function getEmployeeByCode(code: string): Promise<EmployeeListItem | null | Error> {
  const employees = await getEmployeeList({ q: null, dept: null, status: null })

  if (employees instanceof Error) {
    return employees
  }

  for (const employee of employees) {
    if (employee.code === code) {
      return employee
    }
  }

  return null
}
