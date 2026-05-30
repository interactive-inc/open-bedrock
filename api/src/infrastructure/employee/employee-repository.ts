import { Employee } from "@/domain/employee/employee"
import type { Context } from "@/env"
import { employees } from "@/schema"
import { eq, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

export class EmployeeRepository {
  constructor(private readonly c: Context) {}

  async findById(employeeId: number): Promise<Employee | null | Error> {
    return this.findOne(eq(employees.id, employeeId))
  }

  async findByCode(code: string): Promise<Employee | null | Error> {
    return this.findOne(eq(employees.code, code))
  }

  async findByEmail(email: string): Promise<Employee | null | Error> {
    return this.findOne(sql`LOWER(${employees.email}) = LOWER(${email})`)
  }

  private async findOne(condition: SQL): Promise<Employee | null | Error> {
    try {
      const rows = await this.c.var.database.select().from(employees).where(condition).limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Employee.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee")
    }
  }
}
