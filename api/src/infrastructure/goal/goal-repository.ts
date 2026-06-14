import { Goal } from "@/domain/goal/goal.entity"
import type { Context } from "@/env"
import { goals } from "@/schema"
import { and, asc, eq, ne } from "drizzle-orm"

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

  // 社員本人の目標を id の昇順で返す。
  async findByEmployeeId(
    employeeId: number,
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
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to create goal") : Goal.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create goal")
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

  // 目標を削除する。
  async delete(goalId: number): Promise<null | Error> {
    try {
      await this.c.var.database.delete(goals).where(eq(goals.id, goalId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete goal")
    }
  }
}
