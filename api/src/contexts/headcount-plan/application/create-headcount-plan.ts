import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { HeadcountPlan } from "@/contexts/headcount-plan/domain/headcount-plan.entity"
import { ConflictError, ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { HeadcountPlanRepository } from "@/contexts/headcount-plan/infrastructure/headcount-plan-repository"
import { UniqueConstraintError } from "@/lib/d1/unique-constraint-error"

export type Command = {
  session: Session
  fiscalYear: number
  departmentCode: string | null
  plannedCount: number
  note: string | null
  createdAt: string
}

/**
 * 権限と重複(年度・部署)を確認し、人員計画を1件登録する。
 */
export class CreateHeadcountPlan {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<HeadcountPlan | ApplicationError> {
    if (command.session.hasPermission("headcount_plan:manage") === false) {
      return new ForbiddenError("cannot manage headcount plans", "forbidden")
    }

    const repository = new HeadcountPlanRepository(this.c)

    const existing = await repository.findByYearAndDepartment({
      fiscalYear: command.fiscalYear,
      departmentCode: command.departmentCode,
    })

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find headcount plan", { cause: existing })
    }

    if (existing !== null) {
      return new ConflictError("headcount plan already exists", "headcount_plan_conflict")
    }

    const plan = HeadcountPlan.create({
      fiscalYear: command.fiscalYear,
      departmentCode: command.departmentCode,
      plannedCount: command.plannedCount,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.create(plan)

    // findByYearAndDepartment と insert の間の並行挿入で UNIQUE 違反になりうる（TOCTOU 対策）。
    if (created instanceof UniqueConstraintError) {
      return new ConflictError("headcount plan already exists", "headcount_plan_conflict")
    }

    if (created instanceof Error) {
      return new UnexpectedError("failed to create headcount plan", { cause: created })
    }

    return created
  }
}
