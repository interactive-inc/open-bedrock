import { HealthCheckupRepository } from "@/contexts/health-checkup/infrastructure/repositories/health-checkup.repository"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { HealthCheckup } from "@/contexts/health-checkup/domain/entities/health-checkup.entity"
import type { Context } from "@/env"

/**
 * 健診の実施記録を completed へ進め、実施日を記録する。
 * 対象が無ければ not found、scheduled 以外なら遷移不可（conflict）を返す。
 */
export class CompleteHealthCheckup {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(props: { id: number; conductedOn: string }): Promise<HealthCheckup | ApplicationError> {
    const repository = new HealthCheckupRepository(this.c)

    const existing = await repository.findById(props.id)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load health_checkup", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("health checkup not found", "health_checkup_not_found")
    }

    const completed = await repository.complete({ id: props.id, conductedOn: props.conductedOn })

    if (completed instanceof Error) {
      return new UnexpectedError("failed to update health_checkup", { cause: completed })
    }

    if (completed === null) {
      return new ConflictError(
        "health checkup is not scheduled",
        "health_checkup_invalid_transition",
      )
    }

    return completed
  }
}
