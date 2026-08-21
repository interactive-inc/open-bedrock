import type {
  EmployeeDirectoryReadPort,
  EmployeeDirectoryReadPortResult,
} from "@/contexts/company/infrastructure/workforce/read-employee-directory.repository"
import { toWorkforceEmployeeId } from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import type { Context } from "@/env"
import { inArray } from "drizzle-orm"

type Props = Readonly<{
  context: Context
}>

/** 現行Employee台帳を共通Employee directory portへ接続する。 */
export class EmployeeDirectoryReadRepository implements EmployeeDirectoryReadPort {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async findByEmployeeIds(
    employeeIds: ReadonlyArray<EmployeeId>,
  ): Promise<EmployeeDirectoryReadPortResult> {
    const storageEmployeeIds = this.toStorageEmployeeIds(employeeIds)
    if (storageEmployeeIds.length === 0) return { ok: true, employees: [] }

    try {
      return {
        ok: true,
        employees: await this.readEmployees(storageEmployeeIds),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }

  private toStorageEmployeeIds(employeeIds: ReadonlyArray<EmployeeId>): ReadonlyArray<number> {
    return employeeIds.flatMap((employeeId) => {
      const storageEmployeeId = this.toStorageEmployeeId(employeeId)

      return storageEmployeeId === null ? [] : [storageEmployeeId]
    })
  }

  private async readEmployees(storageEmployeeIds: ReadonlyArray<number>) {
    const rows = await this.props.context.var.database
      .select({
        id: employees.id,
        code: employees.code,
        name: employees.name,
        phone: employees.phone,
      })
      .from(employees)
      .where(inArray(employees.id, storageEmployeeIds))

    return rows.map((row) => ({
      id: toWorkforceEmployeeId(row.id),
      officialName: row.name,
      employeeCode: row.code,
      email: null,
      phone: row.phone,
    }))
  }

  private toStorageEmployeeId(employeeId: EmployeeId): number | null {
    const match = /^employee:(0|[1-9]\d*)$/.exec(String(employeeId))
    if (match === null) return null

    const storageEmployeeId = Number(match[1])
    if (!Number.isSafeInteger(storageEmployeeId) || storageEmployeeId < 1) return null

    return toWorkforceEmployeeId(storageEmployeeId) === employeeId ? storageEmployeeId : null
  }
}
