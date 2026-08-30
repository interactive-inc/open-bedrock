import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import {
  GoalEvaluation,
  goalEvaluationKindSchema,
} from "@/contexts/performance-review/domain/entities/goal-evaluation.entity"
import type {
  AlreadyEvaluatedError,
  AlreadyFinalizedError,
  GoalDoneError,
} from "@/contexts/performance-review/infrastructure/repositories/goal/errors"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { goalEvaluations } from "@/contexts/performance-review/infrastructure/schema/goal"
import { asc, eq } from "drizzle-orm"

export class GoalEvaluationRepository {
  constructor(private readonly c: Context) {}

  /** 目標に紐づく評価を作成順（id 昇順）で返す。 */
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

  /**
   * UNIQUE 制約 (goal_id) WHERE kind = 'final' に違反した場合は already_evaluated を返す。
   * goal の status が 'done' の場合は 0 行挿入となり goal_done を返す。
   */
  async create(
    evaluation: GoalEvaluation,
  ): Promise<GoalEvaluation | AlreadyEvaluatedError | GoalDoneError | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `
        INSERT INTO goal_evaluations (goal_id, evaluator_id, kind, score, comment, created_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6
        WHERE EXISTS (SELECT 1 FROM performance_goals WHERE id = ?1 AND status != 'done')
        RETURNING id, goal_id AS goalId, evaluator_id AS evaluatorId, kind, score, comment, created_at AS createdAt
        `,
      )
        .bind(
          evaluation.goalId,
          evaluation.evaluatorId,
          evaluation.kind,
          evaluation.score,
          evaluation.comment,
          evaluation.createdAt,
        )
        .all()

      const row = result.results.at(0) as
        | {
            id: number
            goalId: number
            evaluatorId: EmployeeId
            kind: string
            score: number | null
            comment: string | null
            createdAt: string
          }
        | undefined

      if (row === undefined) {
        return { reason: "goal_done" }
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

  /**
   * final 評価の INSERT と goal の status='done' UPDATE を D1 batch でアトミックに行う。
   * UPDATE が 0 行（既に done）なら abortWhenPreviousStatementChangedNoRows で中断する。
   * UNIQUE 制約違反は already_evaluated を返す。batch 全体が失敗すると rollback される。
   */
  async createWithGoalCompletion(
    evaluation: GoalEvaluation,
    goal: Goal,
  ): Promise<GoalEvaluation | AlreadyEvaluatedError | AlreadyFinalizedError | Error> {
    try {
      const db = this.c.env.DB

      const results = await db.batch([
        db
          .prepare(
            `
          UPDATE performance_goals SET status = 'done' WHERE id = ?1 AND status != 'done'
          `,
          )
          .bind(goal.id),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            `
          INSERT INTO goal_evaluations (goal_id, evaluator_id, kind, score, comment, created_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          RETURNING id, goal_id AS goalId, evaluator_id AS evaluatorId, kind, score, comment, created_at AS createdAt
          `,
          )
          .bind(
            evaluation.goalId,
            evaluation.evaluatorId,
            evaluation.kind,
            evaluation.score,
            evaluation.comment,
            evaluation.createdAt,
          ),
      ])

      const insertResult = results.at(2)
      const row = insertResult?.results?.at(0) as
        | {
            id: number
            goalId: number
            evaluatorId: EmployeeId
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
      if (isAbortedByGuard(error)) {
        return { reason: "already_finalized" }
      }
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

  /** 目標に紐づく評価をすべて削除する。 */
  async deleteByGoalId(goalId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(goalEvaluations).where(eq(goalEvaluations.goalId, goalId))
      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete goal evaluations")
    }
  }
}
