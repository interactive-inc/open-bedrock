import type { Forbidden } from "@/domain/goal/goal-access"
import { GoalEvaluation, type GoalEvaluationKind } from "@/domain/goal/goal-evaluation"
import { resolveEvaluationPermission } from "@/domain/goal/resolve-evaluation-permission"
import type { Context } from "@/env"
import {
  type AlreadyEvaluatedError,
  GoalEvaluationRepository,
} from "@/infrastructure/goal/goal-evaluation-repository"
import { GoalRepository } from "@/infrastructure/goal/goal-repository"

export type Command = {
  goalId: number
  kind: GoalEvaluationKind
  score: number | null
  comment: string | null
  evaluatorId: number
  viewerRole: string
  createdAt: string
}

export type GoalNotFound = { reason: "goal_not_found" }

export type AlreadyEvaluated = { reason: "already_evaluated" }

export type GoalFinalized = { reason: "goal_finalized" }

/**
 * 目標の存在確認・権限判定・評価作成・final時の完了反映までを束ねる。
 */
export class CreateGoalEvaluation {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<GoalEvaluation | GoalNotFound | AlreadyEvaluated | GoalFinalized | Forbidden | Error> {
    const goalRepository = new GoalRepository(this.c)

    const goalEvaluationRepository = new GoalEvaluationRepository(this.c)

    const goal = await goalRepository.findById(command.goalId)

    if (goal instanceof Error) {
      return goal
    }

    if (goal === null) {
      return { reason: "goal_not_found" }
    }

    if (goal.status === "done") {
      return { reason: "goal_finalized" }
    }

    const permission = resolveEvaluationPermission({
      kind: command.kind,
      goalEmployeeId: goal.employeeId,
      viewerEmployeeId: command.evaluatorId,
      viewerRole: command.viewerRole,
    })

    if (permission !== null) {
      return permission
    }

    // self/manager は同一 evaluatorId + kind の重複を禁止する。
    // DB 側にも UNIQUE 制約があるが、先にチェックして明示的なエラーを返す。
    if (command.kind === "self" || command.kind === "manager") {
      const existing = await goalEvaluationRepository.findByGoalId(command.goalId)

      if (existing instanceof Error) {
        return existing
      }

      const duplicate = existing.some(
        (e) => e.evaluatorId === command.evaluatorId && e.kind === command.kind,
      )

      if (duplicate) {
        return { reason: "already_evaluated" }
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
      return await goalEvaluationRepository.createWithGoalCompletion(newEvaluation, goal)
    }

    const evaluation = await goalEvaluationRepository.create(newEvaluation)

    if (evaluation instanceof Error) {
      return evaluation
    }

    if ("reason" in evaluation) {
      return evaluation as AlreadyEvaluatedError
    }

    return evaluation
  }
}
