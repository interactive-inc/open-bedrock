import { EmployeeWorkStyle } from "@/contexts/company/domain/work-style/employee-work-style.entity"
import type { Context } from "@/env"
import { employeeWorkStyles } from "@/schema"
import { count, desc, eq } from "drizzle-orm"

export class EmployeeWorkStyleRepository {
  constructor(private readonly c: Context) {}

  /** 従業員の勤務形態を開始日の降順で返す。 */
  async findByEmployeeId(props: {
    employeeId: number
    limit: number
    offset: number
  }): Promise<ReadonlyArray<EmployeeWorkStyle> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeWorkStyles)
        .where(eq(employeeWorkStyles.employeeId, props.employeeId))
        .orderBy(desc(employeeWorkStyles.startsOn))
        .limit(props.limit)
        .offset(props.offset)

      return rows.map((row) => EmployeeWorkStyle.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee_work_styles")
    }
  }

  async countByEmployeeId(employeeId: number): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ total: count() })
        .from(employeeWorkStyles)
        .where(eq(employeeWorkStyles.employeeId, employeeId))

      return rows.at(0)?.total ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count employee_work_styles")
    }
  }

  async create(workStyle: EmployeeWorkStyle): Promise<EmployeeWorkStyle | Error> {
    try {
      const rows = await this.c.var.database
        .insert(employeeWorkStyles)
        .values({
          employeeId: workStyle.employeeId,
          style: workStyle.style,
          startsOn: workStyle.startsOn,
          endsOn: workStyle.endsOn,
          note: workStyle.note,
          createdAt: workStyle.createdAt,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to create employee_work_style")
        : EmployeeWorkStyle.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to create employee_work_style")
    }
  }
}
