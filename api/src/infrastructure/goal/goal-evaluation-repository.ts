import type { Goal } from "@/domain/goal/goal"
import { GoalEvaluation, goalEvaluationKindSchema } from "@/domain/goal/goal-evaluation"
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

  // final 評価の INSERT と goal の status='done' UPDATE を D1 batch でアトミックに行う。
  // UNIQUE 制約違反は already_evaluated を返す。batch 全体が失敗すると rollback される。
  async createWithGoalCompletion(
    evaluation: GoalEvaluation,
    goal: Goal,
  ): Promise<GoalEvaluation | AlreadyEvaluatedError | Error> {
    try {
      const results = await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `
          INSERT INTO goal_evaluations (goal_id, evaluator_id, kind, score, comment, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          RETURNING id, goal_id AS goalId, evaluator_id AS evaluatorId, kind, score, comment, created_at AS createdAt
          `,
        ).bind(
          evaluation.goalId,
          evaluation.evaluatorId,
          evaluation.kind,
          evaluation.score,
          evaluation.comment,
          evaluation.createdAt,
        ),
        this.c.env.DB.prepare(
          `
          UPDATE goals SET status = 'done' WHERE id = ?1 AND status != 'done'
          `,
        ).bind(goal.id),
      ])

      const insertResult = results.at(0)
      const row = insertResult?.results?.at(0) as
        | {
            id: number
            goalId: number
            evaluatorId: number
            kind: string
            score: number | null
            comment: string | null
            createdAt: string
          }
        | undefined

      if (row === undefined) {
        return new Error("failed to create goal evaluation")
      }

      return new GoalEvaluation({
        id: row.id,
        goalId: row.goalId,
        evaluatorId: row.evaluatorId,
        kind: goalEvaluationKindSchema.parse(row.kind),
        score: row.score,
        comment: row.comment,
        createdAt: row.createdAt,
      })
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { reason: "already_evaluated" }
      }
      return error instanceof Error ? error : new Error("failed to create goal evaluation")
    }
  }

  async delete(evaluationId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(goalEvaluations).where(eq(goalEvaluations.id, evaluationId))
      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete goal evaluation")
    }
  }

  // 目標に紐づく評価をすべて削除する。
  async deleteByGoalId(goalId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(goalEvaluations).where(eq(goalEvaluations.goalId, goalId))
      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete goal evaluations")
    }
  }
}
