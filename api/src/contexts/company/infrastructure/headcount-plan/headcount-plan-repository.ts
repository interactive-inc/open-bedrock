import { HeadcountPlan } from "@/domain/headcount-plan/headcount-plan.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { employees, headcountPlans, orgMemberships } from "@/schema"
import { and, asc, count, eq, isNull } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class HeadcountPlanRepository {
  constructor(private readonly c: Context) {}

  async list(props: {
    fiscalYear: number | null
    limit: number
    offset: number
  }): Promise<ReadonlyArray<HeadcountPlan> | Error> {
    try {
      const condition =
        props.fiscalYear === null ? undefined : eq(headcountPlans.fiscalYear, props.fiscalYear)

      const rows = await this.c.var.database
        .select()
        .from(headcountPlans)
        .where(condition)
        .orderBy(asc(headcountPlans.fiscalYear), asc(headcountPlans.departmentCode))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => HeadcountPlan.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load headcount_plans")
    }
  }

  async count(fiscalYear: number | null): Promise<number | Error> {
    try {
      const condition = fiscalYear === null ? undefined : eq(headcountPlans.fiscalYear, fiscalYear)

      const rows = await this.c.var.database
        .select({ total: count() })
        .from(headcountPlans)
        .where(condition)

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count headcount_plans")
    }
  }

  async findByYearAndDepartment(props: {
    fiscalYear: number
    departmentCode: string | null
  }): Promise<HeadcountPlan | null | Error> {
    try {
      const condition: SQL | undefined =
        props.departmentCode === null
          ? and(
              eq(headcountPlans.fiscalYear, props.fiscalYear),
              isNull(headcountPlans.departmentCode),
            )
          : and(
              eq(headcountPlans.fiscalYear, props.fiscalYear),
              eq(headcountPlans.departmentCode, props.departmentCode),
            )

      const rows = await this.c.var.database.select().from(headcountPlans).where(condition).limit(1)

      const row = rows.at(0)

      return row === undefined ? null : HeadcountPlan.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find headcount_plan")
    }
  }

  async findById(id: number): Promise<HeadcountPlan | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(headcountPlans)
        .where(eq(headcountPlans.id, id))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : HeadcountPlan.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to find headcount_plan")
    }
  }

  async create(plan: HeadcountPlan): Promise<HeadcountPlan | UniqueConstraintError | Error> {
    try {
      const rows = await this.c.var.database
        .insert(headcountPlans)
        .values({
          fiscalYear: plan.fiscalYear,
          departmentCode: plan.departmentCode,
          plannedCount: plan.plannedCount,
          note: plan.note,
          createdAt: plan.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create headcount_plan")
        : HeadcountPlan.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("headcount plan already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to create headcount_plan")
    }
  }

  async update(id: number, plan: HeadcountPlan): Promise<HeadcountPlan | Error> {
    try {
      const rows = await this.c.var.database
        .update(headcountPlans)
        .set({ plannedCount: plan.plannedCount, note: plan.note })
        .where(eq(headcountPlans.id, id))
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to update headcount_plan")
        : HeadcountPlan.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update headcount_plan")
    }
  }

  /** 部署コードごとの active 在籍数。org_memberships と employees(code) を突き合わせ status=active を数える。 */
  async countActiveByDepartment(): Promise<Map<string, number> | Error> {
    try {
      const rows = await this.c.var.database
        .select({ departmentCode: orgMemberships.departmentCode, total: count() })
        .from(orgMemberships)
        .innerJoin(employees, eq(employees.code, orgMemberships.employeeCode))
        .where(eq(employees.status, "active"))
        .groupBy(orgMemberships.departmentCode)

      const countsByCode = new Map<string, number>()

      for (const row of rows) {
        countsByCode.set(row.departmentCode, row.total)
      }

      return countsByCode
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count active employees")
    }
  }

  /** 全社の active 在籍数（department_code が null の計画の実績に添える）。 */
  async countActiveTotal(): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(employees)
        .where(eq(employees.status, "active"))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count active employees")
    }
  }
}
