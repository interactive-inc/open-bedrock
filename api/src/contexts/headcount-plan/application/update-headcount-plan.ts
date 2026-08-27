import type { Session } from "@/lib/auth/session"
import { HeadcountPlan } from "@/contexts/headcount-plan/domain/entities/headcount-plan.entity"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { HeadcountPlanRepository } from "@/contexts/headcount-plan/infrastructure/repositories/headcount-plan.repository"

export type Command = {
  session: Session
  id: number
  plannedCount: number
  note: string | null
}

/**
 * 権限と存在を確認し、人員計画の計画人数・備考を差し替える。年度・部署は変えない。
 */
export class UpdateHeadcountPlan {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<HeadcountPlan | ApplicationError> {
    if (command.session.hasPermission("headcount_plan:manage") === false) {
      return new ForbiddenError("cannot manage headcount plans", "forbidden")
    }

    const repository = new HeadcountPlanRepository(this.c)

    const existing = await repository.findById(command.id)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find headcount plan", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("headcount plan not found", "headcount_plan_not_found")
    }

    const next = existing.withDetails({ plannedCount: command.plannedCount, note: command.note })

    const updated = await repository.update(command.id, next)

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update headcount plan", { cause: updated })
    }

    return updated
  }
}
