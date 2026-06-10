import { GoalEvaluation } from "@/domain/goal/goal-evaluation"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { goalEvaluations } from "@/schema"
import { asc, eq } from "drizzle-orm"

export type AlreadyEvaluatedError = { reason: "already_evaluated" }

export class GoalEvaluationRepository {
  constructor(private readonly c: Context) {}

  // 目標に紐づく評価を作成順（id 昇順）で返す。
  async findByGoalId(goalId: number): Promise<ReadonlyArray<GoalEvaluation> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(goalEvaluations)
        .where(eq(goalEvaluations.goalId, goalId))
        .orderBy(asc(goalEvaluations.id))

      return rows.map((row) => GoalEvaluation.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load goal_evaluations")
    }
  }

  // UNIQUE 制約 (goal_id) WHERE kind = 'final' に違反した場合は already_evaluated を返す。
  async create(
    evaluation: GoalEvaluation,
  ): Promise<GoalEvaluation | AlreadyEvaluatedError | Error> {
    try {
      const rows = await this.c.var.database
        .insert(goalEvaluations)
        .values({
          goalId: evaluation.goalId,
          evaluatorId: evaluation.evaluatorId,
          kind: evaluation.kind,
          score: evaluation.score,
          comment: evaluation.comment,
          createdAt: evaluation.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create goal evaluation")
        : GoalEvaluation.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { reason: "already_evaluated" }
      }
      return error instanceof Error ? error : new Error("failed to create goal evaluation")
    }
  }
}
