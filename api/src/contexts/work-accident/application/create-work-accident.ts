import { WorkAccidentRepository } from "@/contexts/work-accident/infrastructure/repositories/work-accident.repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { WorkAccident } from "@/contexts/work-accident/domain/entities/work-accident.entity"
import type { Context } from "@/env"

/**
 * 労災・事故の発生記録を作成する。起きた事実の記録のみで、労災認定判定はしない。
 */
export class CreateWorkAccident {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(props: {
    occurredOn: string
    employeeId: number | null
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
      return new UnexpectedError("failed to save work_accident", { cause: created })
    }

    return created
  }
}
