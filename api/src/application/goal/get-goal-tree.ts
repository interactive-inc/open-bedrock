import type { Session } from "@/domain/company/iam/session"
import type { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"
import { buildGoalTree } from "@/application/goal/build-goal-tree"
import { canReadGoalOf } from "@/lib/goal/can-read-goal-of"
import type { AppGoalTreeNode } from "@/lib/app-schemas"
import { resolveEmployeeRelation } from "@/lib/org/resolve-employee-relation"

export type Command = {
  period: string | null
  session: Session
}

/**
 * 全社→部門→個人のツリーを組む。全社・部門目標は全認証者が閲覧でき、個人目標(葉)は
 * 既存のスコープ判定(self/reports/department/all)で閲覧できるものだけを残す。
 */
export class GetGoalTree {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ReadonlyArray<AppGoalTreeNode> | ApplicationError> {
    const repository = new GoalRepository(this.c)

    const goals = await repository.findAllByPeriod(command.period)

    if (goals instanceof Error) {
      return new UnexpectedError("failed to load goals", { cause: goals })
    }

    const visible = await this.toVisibleGoals(goals, command.session)

    if (visible instanceof Error) {
      return new UnexpectedError("failed to resolve goal visibility", { cause: visible })
    }

    return buildGoalTree({ goals: visible })
  }

  /** 個人目標のうち閲覧スコープ外のものを除く。全社・部門目標は常に残す。 */
  private async toVisibleGoals(
    goals: ReadonlyArray<Goal>,
    session: Session,
  ): Promise<ReadonlyArray<Goal> | Error> {
    const visible: Array<Goal> = []

    for (const goal of goals) {
      if (goal.ownerType !== "individual") {
        visible.push(goal)

        continue
      }

      const relation = await resolveEmployeeRelation({
        c: this.c,
        viewerEmployeeId: session.employeeId,
        targetEmployeeId: goal.employeeId,
      })

      if (relation instanceof Error) {
        return relation
      }

      if (canReadGoalOf(session, relation)) {
        visible.push(goal)
      }
    }

    return visible
  }
}
