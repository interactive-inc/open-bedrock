import { WorkAccidentRepository } from "@/infrastructure/work-accident/work-accident-repository"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { WorkAccident } from "@/domain/work-accident/work-accident.entity"
import type { Context } from "@/env"

/**
 * 労災・事故の発生記録を closed へ進める。
 * 対象が無ければ not found、reported 以外なら遷移不可（conflict）を返す。
 */
export class CloseWorkAccident {
  constructor(private readonly c: Context) {}

  async run(props: { id: number }): Promise<WorkAccident | ApplicationError> {
    const repository = new WorkAccidentRepository(this.c)

    const existing = await repository.findById(props.id)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to load work_accident", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("work accident not found", "work_accident_not_found")
    }

    const closed = await repository.close(props.id)

    if (closed instanceof Error) {
      return new UnexpectedError("failed to update work_accident", { cause: closed })
    }

    if (closed === null) {
      return new ConflictError("work accident is not reported", "work_accident_invalid_transition")
    }

    return closed
  }
}
