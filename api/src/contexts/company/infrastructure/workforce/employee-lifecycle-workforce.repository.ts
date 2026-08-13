import type {
  WorkforceLifecycleReadPort,
  WorkforceLifecycleReadPortResult,
} from "@/contexts/company/application/workforce/read-workforce-state"
import {
  toWorkforceEmployeeId,
  toWorkforceLifecycleSchedules,
} from "@/contexts/company/domain/employee-lifecycle/to-workforce-lifecycle-schedules"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"
import { EmployeeLifecycleRepository } from "@/contexts/company/infrastructure/employee-lifecycle/employee-lifecycle-repository"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"

function storageEmployeeId(employeeId: EmployeeId): number | null {
  const match = /^employee:(0|[1-9]\d*)$/.exec(String(employeeId))
  if (match === null) return null

  const value = Number(match[1])
  if (!Number.isSafeInteger(value) || value < 1) return null
  return toWorkforceEmployeeId(value) === employeeId ? value : null
}

function emptySchedule(employeeId: EmployeeId): WorkforceLifecycleSchedule {
  return {
    employeeId,
    employments: [],
    statuses: [],
    assignments: [],
    responsibilities: [],
  }
}

/** open-bedrockのD1 lifecycle tablesを共通Workforce Application portへ接続する。 */
export class EmployeeLifecycleWorkforceRepository implements WorkforceLifecycleReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByEmployeeId(employeeId: EmployeeId): Promise<WorkforceLifecycleReadPortResult> {
    const sourceEmployeeId = storageEmployeeId(employeeId)
    if (sourceEmployeeId === null) return { ok: true, schedule: null }

    try {
      const exists = await this.c.env.DB.prepare("SELECT id FROM employees WHERE id = ?1")
        .bind(sourceEmployeeId)
        .first<number>("id")
      if (exists === null) return { ok: true, schedule: null }

      const source = await new EmployeeLifecycleRepository(this.c).loadSchedule(sourceEmployeeId)
      if (source instanceof ApplicationError) return { ok: false, cause: source }

      return {
        ok: true,
        schedule: toWorkforceLifecycleSchedules([source])[0] ?? emptySchedule(employeeId),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
