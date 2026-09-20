type Context = D1Database

export type RegisteredEmployeeByOperation = Readonly<{
  kind: string
  payloadFingerprint: string
  recordedByAccountId: string | null
  employeeCode: string
  officialName: string
  accountId: string
}>

/** 冪等keyで確定済みの入社発令と、その従業員に対応するAccountを返す。再送の照合に使う。 */
export class FindRegisteredEmployeeByOperationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(operationId: string): Promise<RegisteredEmployeeByOperation | null | Error> {
    try {
      const row = await this.c
        .prepare(
          `SELECT action.kind, action.payload_fingerprint, action.recorded_by_account_id,
                employee.employee_code, employee.official_name, link.account_id
           FROM company_personnel_actions AS action
           JOIN company_employees AS employee ON employee.id = action.employee_id
           JOIN company_account_employee_resource_bindings AS link ON link.employee_id = employee.id
          WHERE action.operation_id = ?1`,
        )
        .bind(operationId)
        .first<{
          kind: string
          payload_fingerprint: string
          recorded_by_account_id: string | null
          employee_code: string
          official_name: string
          account_id: string
        }>()
      if (row === null) return null
      return {
        kind: row.kind,
        payloadFingerprint: row.payload_fingerprint,
        recordedByAccountId: row.recorded_by_account_id,
        employeeCode: row.employee_code,
        officialName: row.official_name,
        accountId: row.account_id,
      }
    } catch (cause) {
      return new Error("registered employee is unavailable", { cause })
    }
  }
}
