import type { Session } from "@/contexts/company-compatibility/domain/iam/session"
import {
  GoalEvaluation,
  type GoalEvaluationKind,
} from "@/contexts/performance-review/domain/goal/goal-evaluation.entity"
import { resolveEvaluationPermission } from "@/contexts/performance-review/application/goal/resolve-evaluation-permission"
import { resolveEmployeeRelation } from "@/contexts/company-compatibility/application/organization/resolve-employee-relation"
import type { EmployeeRelation } from "@/contexts/company-compatibility/domain/organization/employee-relation"
import type { Context } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalEvaluationRepository } from "@/contexts/performance-review/infrastructure/goal/goal-evaluation-repository"
import { GoalRepository } from "@/contexts/performance-review/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
  evaluatorId: number
  session: Session
  createdAt: string
}

/**
 * 目標の存在確認・権限判定・評価作成・final時の完了反映までを束ねる。
 */
export class CreateGoalEvaluation {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<GoalEvaluation | ApplicationError> {
    const goalRepository = new GoalRepository(this.c)

    const goalEvaluationRepository = new GoalEvaluationRepository(this.c)

    const goal = await goalRepository.findById(command.goalId)

    if (goal instanceof Error) {
      return new UnexpectedError("failed to find goal", { cause: goal })
    }

    if (goal === null) {
      return new NotFoundError("goal not found", "goal_not_found")
    }

    if (goal.status === "done") {
      return new ConflictError("goal is already finalized", "goal_finalized")
    }

    const relation = await this.resolveRelation(command.kind, goal.employeeId, command.evaluatorId)

    if (relation instanceof Error) {
      return new UnexpectedError("failed to resolve employee relation", { cause: relation })
    }

    const permission = resolveEvaluationPermission({
      kind: command.kind,
      goalEmployeeId: goal.employeeId,
      viewerEmployeeId: command.evaluatorId,
      session: command.session,
      relation,
    })

    if (permission !== null) {
      return new ForbiddenError("cannot evaluate this goal", "forbidden")
    }

    // self/manager は同一 evaluatorId + kind の重複を禁止する。
    // DB 側にも UNIQUE 制約があるが、先にチェックして明示的なエラーを返す。
    if (command.kind === "self" || command.kind === "manager") {
      const existing = await goalEvaluationRepository.findByGoalId(command.goalId)

      if (existing instanceof Error) {
        return new UnexpectedError("failed to find goal evaluations", { cause: existing })
      }

      const duplicate = existing.some(
        (e) => e.evaluatorId === command.evaluatorId && e.kind === command.kind,
      )

      if (duplicate) {
        return new ConflictError("already evaluated", "already_evaluated")
      }
    }

    const newEvaluation = GoalEvaluation.create({
      goalId: command.goalId,
      evaluatorId: command.evaluatorId,
      kind: command.kind,
      score: command.score,
      comment: command.comment,
      createdAt: command.createdAt,
    })

    // final 評価は goal の status='done' 更新と D1 batch でアトミックに行う。
    // 非 final 評価は単独 INSERT で十分。
    if (command.kind === "final") {
      const result = await goalEvaluationRepository.createWithGoalCompletion(newEvaluation, goal)

      if (result instanceof Error) {
        return new UnexpectedError("failed to create goal evaluation", { cause: result })
      }

      if ("reason" in result) {
        if (result.reason === "already_finalized") {
          return new ConflictError("goal is already finalized", "goal_finalized")
        }

        return new ConflictError("already evaluated", "already_evaluated")
      }

      return result
    }

    const evaluation = await goalEvaluationRepository.create(newEvaluation)

    if (evaluation instanceof Error) {
      return new UnexpectedError("failed to create goal evaluation", { cause: evaluation })
    }

    if ("reason" in evaluation) {
      if (evaluation.reason === "goal_done") {
        return new ConflictError("goal is already finalized", "goal_finalized")
      }

      return new ConflictError("already evaluated", "already_evaluated")
    }

    return evaluation
  }

  /** self 評価は本人一致のみで判定するため org を引かない。manager/final のみ関係を解決する。 */
  private async resolveRelation(
    kind: GoalEvaluationKind,
    goalEmployeeId: number,
    evaluatorId: number,
  ): Promise<EmployeeRelation | Error> {
    if (kind === "self") {
      return { isSelf: false, isReport: false, isSameDepartment: false }
    }

    return resolveEmployeeRelation({
      c: this.c,
      viewerEmployeeId: evaluatorId,
      targetEmployeeId: goalEmployeeId,
    })
  }
}
