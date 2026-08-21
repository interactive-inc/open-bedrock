import { DisciplinaryAction } from "@/contexts/disciplinary-action/domain/disciplinary-action.entity"
import type { Context } from "@/env"
import { disciplinaryActions } from "@/contexts/disciplinary-action/infrastructure/schema/disciplinary-action"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class DisciplinaryActionRepository {
  constructor(private readonly c: Context) {}

  async list(props: {
    employeeId: number | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<DisciplinaryAction> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(disciplinaryActions)
        .where(this.toConditions(props.employeeId))
        .orderBy(desc(disciplinaryActions.decidedOn))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => DisciplinaryAction.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load disciplinary_actions")
    }
  }

  async count(employeeId: number | null): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(disciplinaryActions)
        .where(this.toConditions(employeeId))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count disciplinary_actions")
    }
  }

  async create(action: DisciplinaryAction): Promise<DisciplinaryAction | Error> {
    try {
      const rows = await this.c.var.database
        .insert(disciplinaryActions)
        .values({
          employeeId: action.employeeId,
          kind: action.kind,
          summary: action.summary,
          decidedOn: action.decidedOn,
          createdAt: action.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create disciplinary_action")
        : DisciplinaryAction.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create disciplinary_action")
    }
  }

  private toConditions(employeeId: number | null): SQL | undefined {
    const conditions: Array<SQL> = []

    if (employeeId !== null) {
      conditions.push(eq(disciplinaryActions.employeeId, employeeId))
    }

    return conditions.length === 0 ? undefined : and(...conditions)
  }
}
