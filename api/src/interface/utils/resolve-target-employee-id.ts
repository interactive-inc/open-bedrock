import type { Context } from "@/env"
import { EmployeeRepository } from "@/infrastructure/employee/employee-repository"

export type Props = {
  c: Context
  employeeIdParam: string | undefined
  employeeCodeParam: string | undefined
  sessionEmployeeId: number
}

/**
 * リスト系ルートの対象従業員 id を、employee_id / employee_code のいずれか（未指定は本人）から解決する。
 * employee_code 指定時は台帳を引いて数値 id に直す。解決できない code は null（=対象なし）を返す。
 */
export async function resolveTargetEmployeeId(props: Props): Promise<number | null | Error> {
  if (props.employeeCodeParam !== undefined) {
    const repository = new EmployeeRepository(props.c)

    const employee = await repository.findByCode(props.employeeCodeParam)

    if (employee instanceof Error) {
      return employee
    }

    return employee === null ? null : employee.id
  }

  if (props.employeeIdParam !== undefined) {
    const parsed = Number(props.employeeIdParam)

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  return props.sessionEmployeeId
}
