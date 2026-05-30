import { Goal } from "@/domain/goal/goal"
import type { Context } from "@/env"
import { goals } from "@/schema"
import { eq } from "drizzle-orm"

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
      const rows = await this.c.var.database
        .update(goals)
        .set({ status: goal.status })
        .where(eq(goals.id, goal.id))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Goal.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update goal status")
    }
  }
}
