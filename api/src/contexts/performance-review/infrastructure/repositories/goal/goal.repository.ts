import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { Goal } from "@/contexts/performance-review/domain/entities/goal.entity"
import type { Context } from "@/env"
import { goals } from "@/contexts/performance-review/infrastructure/schema/goal"
import { evaluationSheets } from "@/contexts/performance-review/infrastructure/schema/performance-review"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { ConflictError } from "@/lib/errors"
import { and, asc, eq, ne, sum } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

type GoalRow = {
  id: number
  employee_id: EmployeeId
  period: string
  title: string
  kpi: string
  weight: number
  status: Goal["status"]
  owner_type: Goal["ownerType"]
  parent_goal_id: number | null
  department_code: string | null
  evaluation_sheet_id: number | null
}

export class GoalRepository {
  constructor(private readonly c: Context) {}

  async findById(goalId: number): Promise<Goal | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(goals)
        .where(eq(goals.id, goalId))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Goal.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load goal")
    }
  }

  /** 社員本人の目標を id の昇順で返す。 */
  async findByEmployeeId(
    employeeId: EmployeeId,
    opts?: { limit: number; offset: number },
  ): Promise<ReadonlyArray<Goal> | Error> {
    try {
      const query = this.c.var.database
        .select()
        .from(goals)
        .where(eq(goals.employeeId, employeeId))
        .orderBy(asc(goals.id))

      const rows =
        opts !== undefined ? await query.limit(opts.limit).offset(opts.offset) : await query

      return rows.map((row) => Goal.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load goals")
    }
  }

  /** 指定 period の目標を全 owner_type ぶん id 昇順で返す。period 未指定なら全期間。 */
  async findAllByPeriod(period: string | null): Promise<ReadonlyArray<Goal> | Error> {
    try {
      const conditions: Array<SQL> = []

      if (period !== null) {
        conditions.push(eq(goals.period, period))
      }

      const rows = await this.c.var.database
        .select()
        .from(goals)
        .where(and(...conditions))
        .orderBy(asc(goals.id))

      return rows.map((row) => Goal.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load goals")
    }
  }

  async create(goal: Goal): Promise<Goal | Error> {
    try {
      const rows = await this.c.var.database
        .insert(goals)
        .values({
          employeeId: goal.employeeId,
          period: goal.period,
          title: goal.title,
          kpi: goal.kpi,
          weight: goal.weight,
          status: goal.status,
          ownerType: goal.ownerType,
          parentGoalId: goal.parentGoalId,
          departmentCode: goal.departmentCode,
          evaluationSheetId: goal.evaluationSheetId,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to create goal") : Goal.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create goal")
    }
  }

  async findEvaluationSheetState(sheetId: number): Promise<
    | Readonly<{
        employeeId: EmployeeId
        period: string
        status: string
      }>
    | null
    | Error
  > {
    try {
      const rows = await this.c.var.database
        .select({
          employeeId: evaluationSheets.employeeId,
          period: evaluationSheets.period,
          status: evaluationSheets.status,
        })
        .from(evaluationSheets)
        .where(eq(evaluationSheets.id, sheetId))
        .limit(1)
      return rows.at(0) ?? null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load evaluation sheet")
    }
  }

  async totalWeightForEvaluationSheet(sheetId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: sum(goals.weight) })
        .from(goals)
        .where(eq(goals.evaluationSheetId, sheetId))
      return Number(rows.at(0)?.total ?? 0)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load goal weights")
    }
  }

  async createForEvaluationSheet(
    goal: Goal,
    actorEmployeeId: EmployeeId,
    now: string,
  ): Promise<Goal | Error> {
    try {
      if (goal.evaluationSheetId === null) return new Error("evaluation sheet is required")
      const db = this.c.env.DB
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO performance_goals
               (employee_id, period, title, kpi, weight, status, owner_type,
                parent_goal_id, department_code, evaluation_sheet_id)
             SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
             WHERE EXISTS (
               SELECT 1 FROM evaluation_sheets
               WHERE id = ?10 AND employee_id = ?1 AND period = ?2
                 AND status IN ('draft', 'rejected')
             )
             AND (
               SELECT COALESCE(SUM(weight), 0) FROM performance_goals
               WHERE evaluation_sheet_id = ?10
             ) + ?5 <= 100`,
          )
          .bind(
            goal.employeeId,
            goal.period,
            goal.title,
            goal.kpi,
            goal.weight,
            goal.status,
            goal.ownerType,
            goal.parentGoalId,
            goal.departmentCode,
            goal.evaluationSheetId,
          ),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare(
          `SELECT id, employee_id, period, title, kpi, weight, status,
                  owner_type, parent_goal_id, department_code, evaluation_sheet_id
           FROM performance_goals WHERE id = last_insert_rowid()`,
        ),
        db
          .prepare(
            `INSERT INTO evaluation_sheet_audit_logs
               (sheet_id, actor_id, action, from_value, to_value, note, created_at)
             VALUES (?1, ?2, 'goal_add', NULL,
               json_object('goal_id', last_insert_rowid(), 'title', ?3, 'weight', ?4, 'period', ?5, 'kpi', ?6),
               NULL, ?7)`,
          )
          .bind(
            goal.evaluationSheetId,
            actorEmployeeId,
            goal.title,
            goal.weight,
            goal.period,
            goal.kpi,
            now,
          ),
      ])
      const row = (results[2] as D1Result<GoalRow> | undefined)?.results?.at(0)
      return row === undefined
        ? new Error("failed to read back created goal")
        : Goal.fromRow({
            id: row.id,
            employeeId: row.employee_id,
            period: row.period,
            title: row.title,
            kpi: row.kpi,
            weight: row.weight,
            status: row.status,
            ownerType: row.owner_type,
            parentGoalId: row.parent_goal_id,
            departmentCode: row.department_code,
            evaluationSheetId: row.evaluation_sheet_id,
          })
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "concurrent modification: sheet status, period, or weight constraint changed",
          "concurrent_conflict",
        )
      }
      return error instanceof Error ? error : new Error("failed to create goal")
    }
  }

  async deleteWithEvaluations(
    goal: Goal,
    actorEmployeeId: EmployeeId,
    now: string,
  ): Promise<null | Error> {
    try {
      if (goal.id === null) return new Error("cannot delete unsaved goal")
      const db = this.c.env.DB
      const statements: Parameters<typeof db.batch>[0] = [
        db.prepare("DELETE FROM goal_evaluations WHERE goal_id = ?1").bind(goal.id),
        db
          .prepare(
            goal.evaluationSheetId === null
              ? "DELETE FROM performance_goals WHERE id = ?1 AND status != 'done'"
              : `DELETE FROM performance_goals
                 WHERE id = ?1 AND status != 'done'
                   AND (SELECT status FROM evaluation_sheets WHERE id = ?2)
                       IN ('draft', 'rejected')`,
          )
          .bind(goal.id, ...(goal.evaluationSheetId === null ? [] : [goal.evaluationSheetId])),
        abortWhenPreviousStatementChangedNoRows(db),
      ]
      if (goal.evaluationSheetId !== null) {
        statements.push(
          db
            .prepare(
              `INSERT INTO evaluation_sheet_audit_logs
                 (sheet_id, actor_id, action, from_value, to_value, note, created_at)
               VALUES (?1, ?2, 'goal_delete', ?3, NULL, NULL, ?4)`,
            )
            .bind(
              goal.evaluationSheetId,
              actorEmployeeId,
              JSON.stringify({
                goal_id: goal.id,
                title: goal.title,
                weight: goal.weight,
                period: goal.period,
                kpi: goal.kpi,
              }),
              now,
            ),
        )
      }
      await db.batch(statements)
      return null
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "concurrent modification: goal status or sheet status changed",
          "concurrent_conflict",
        )
      }
      return error instanceof Error ? error : new Error("failed to delete goal")
    }
  }

  async updateForEvaluationSheet(
    goal: Goal,
    previous: Goal,
    actorEmployeeId: EmployeeId,
    now: string,
  ): Promise<Goal | Error> {
    try {
      if (goal.id === null || goal.evaluationSheetId === null) {
        return new Error("saved goal with evaluation sheet is required")
      }
      const db = this.c.env.DB
      await db.batch([
        db
          .prepare(
            `UPDATE performance_goals
             SET period = ?1, title = ?2, kpi = ?3, weight = ?4
             WHERE id = ?5 AND status != 'done' AND evaluation_sheet_id = ?6
               AND EXISTS (
                 SELECT 1 FROM evaluation_sheets
                 WHERE id = ?6 AND status IN ('draft', 'rejected') AND period = ?1
               )
               AND (
                 SELECT COALESCE(SUM(pg.weight), 0) FROM performance_goals pg
                 WHERE pg.evaluation_sheet_id = ?6 AND pg.id != ?5
               ) + ?4 <= 100`,
          )
          .bind(goal.period, goal.title, goal.kpi, goal.weight, goal.id, goal.evaluationSheetId),
        abortWhenPreviousStatementChangedNoRows(db),
        db
          .prepare(
            `INSERT INTO evaluation_sheet_audit_logs
               (sheet_id, actor_id, action, from_value, to_value, note, created_at)
             VALUES (?1, ?2, 'goal_update', ?3, ?4, NULL, ?5)`,
          )
          .bind(
            goal.evaluationSheetId,
            actorEmployeeId,
            JSON.stringify({
              goal_id: previous.id,
              title: previous.title,
              weight: previous.weight,
              period: previous.period,
              kpi: previous.kpi,
            }),
            JSON.stringify({
              goal_id: goal.id,
              title: goal.title,
              weight: goal.weight,
              period: goal.period,
              kpi: goal.kpi,
            }),
            now,
          ),
      ])
      return (await this.findById(goal.id)) ?? new Error("failed to read back updated goal")
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return new ConflictError(
          "concurrent modification: sheet status, period, or weight constraint changed",
          "concurrent_conflict",
        )
      }
      return error instanceof Error ? error : new Error("failed to update goal")
    }
  }

  async update(goal: Goal): Promise<Goal | null | Error> {
    try {
      if (goal.id === null) {
        return new Error("cannot update unsaved goal")
      }

      const rows = await this.c.var.database
        .update(goals)
        .set({
          period: goal.period,
          title: goal.title,
          kpi: goal.kpi,
          weight: goal.weight,
          status: goal.status,
        })
        .where(and(eq(goals.id, goal.id), ne(goals.status, "done")))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Goal.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update goal")
    }
  }

  /** 目標を削除する。 */
  async delete(goalId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(goals).where(eq(goals.id, goalId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete goal")
    }
  }
}
