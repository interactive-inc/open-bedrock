import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"

export type Props = {
  c: Context
  employeeId: number | undefined
  employeeCode: string | undefined
}

/**
 * 登録系ルートの対象従業員 id を、リクエストボディの employee_id / employee_code のいずれかから解決する。
 * employee_code 指定時は台帳を引いて数値 id に直す。解決できない code は null（=対象なし）を返す。
 * どちらを渡すかの検証（exactly one）は各ルートの zValidator が行う。
 */
export async function resolveEmployeeIdFromBody(props: Props): Promise<number | null | Error> {
  if (props.employeeId !== undefined) {
    return props.employeeId
  }

  if (props.employeeCode !== undefined) {
    const repository = new EmployeeRepository(props.c)

    const employee = await repository.findByCode(props.employeeCode)

    if (employee instanceof Error) {
      return employee
    }

    return employee === null ? null : employee.id
  }

  return null
}
