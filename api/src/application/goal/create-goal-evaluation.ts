import { GoalEvaluation, type GoalEvaluationKind } from "@/domain/goal/goal-evaluation.entity"
import { resolveEvaluationPermission } from "@/lib/goal/resolve-evaluation-permission"
import type { Context, SessionPayload } from "@/env"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { GoalEvaluationRepository } from "@/infrastructure/goal/goal-evaluation-repository"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
  evaluatorId: number
  viewerSession: SessionPayload
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

    const permission = resolveEvaluationPermission({
      kind: command.kind,
      goalEmployeeId: goal.employeeId,
      viewerEmployeeId: command.evaluatorId,
      viewerSession: command.viewerSession,
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
}
