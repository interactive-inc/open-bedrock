import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { WorkAccidentRepository } from "@/contexts/work-accident/infrastructure/repositories/work-accident.repository"
import { ConflictError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { WorkAccident } from "@/contexts/work-accident/domain/entities/work-accident.entity"
import type { Context } from "@/env"
import { isWorkAccidentRecordSourceFrozenError } from "@/contexts/work-accident/infrastructure/repositories/lib/is-work-accident-record-source-frozen-error"

/**
 * 労災・事故の発生記録を作成する。起きた事実の記録のみで、労災認定判定はしない。
 */
export class CreateWorkAccident {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(props: {
    occurredOn: string
    employeeId: EmployeeId | null
    location: string | null
    summary: string
    severity: "minor" | "serious" | null
    createdAt: string
  }): Promise<WorkAccident | ApplicationError> {
    const repository = new WorkAccidentRepository(this.c)

    const created = await repository.create({
      occurredOn: props.occurredOn,
      employeeId: props.employeeId,
      location: props.location,
      summary: props.summary,
      severity: props.severity,
      status: "reported",
      createdAt: props.createdAt,
    })

    if (created instanceof Error) {
      if (isWorkAccidentRecordSourceFrozenError(created))
        return new ConflictError("work accident writes are frozen", "record_source_frozen", {
          cause: created,
        })
      return new UnexpectedError("failed to save work_accident", { cause: created })
    }

    return created
  }
}
