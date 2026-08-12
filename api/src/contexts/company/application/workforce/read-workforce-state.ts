import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import {
  resolveWorkforceStateAt,
  WorkforceStateResolutionError,
  type WorkforceStateAt,
} from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { EmployeeId } from "@/contexts/company/domain/workforce/workforce-id"

export type WorkforceLifecycleReadPortResult =
  | Readonly<{ ok: true; schedule: WorkforceLifecycleSchedule | null }>
  | Readonly<{ ok: false; cause: unknown }>

export interface WorkforceLifecycleReadPort {
  findByEmployeeId(employeeId: EmployeeId): Promise<WorkforceLifecycleReadPortResult>
}

export type ReadWorkforceStateResult =
  | Readonly<{ kind: "found"; state: WorkforceStateAt }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "invalid_schedule"; error: WorkforceStateResolutionError }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

/** 製品固有の永続化をportの外へ閉じ、Companyの基準日時点状態を読む。 */
export class ReadWorkforceState {
  constructor(private readonly port: WorkforceLifecycleReadPort) {
    Object.freeze(this)
  }

  async execute(props: {
    employeeId: EmployeeId
    asOf: CalendarDate
  }): Promise<ReadWorkforceStateResult> {
    let loaded: WorkforceLifecycleReadPortResult
    try {
      loaded = await this.port.findByEmployeeId(props.employeeId)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }

    if (!loaded.ok) return { kind: "unavailable", cause: loaded.cause }
    if (loaded.schedule === null) return { kind: "not_found" }

    const state = resolveWorkforceStateAt(loaded.schedule, props.asOf)
    return state instanceof WorkforceStateResolutionError
      ? { kind: "invalid_schedule", error: state }
      : { kind: "found", state }
  }
}
