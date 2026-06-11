import { Employee } from "@/domain/employee/employee"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { employees } from "@/schema"
import { count, eq, sql } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

// 新規従業員の登録に必要な値。id は DB が採番するため含めない。
export type NewEmployee = {
  code: string
  name: string
  email: string
  passwordHash: string
  role: string
  deptId: number | null
  deptName: string | null
  position: string | null
  status: "active" | "leave" | "retired"
}

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

  // 指定ロールの従業員数を返す。
  async countByRole(role: string): Promise<number | Error> {
    try {
      const rows = await this.c.var.database
        .select({ value: count() })
        .from(employees)
        .where(eq(employees.role, role))

      return rows.at(0)?.value ?? 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count employees by role")
    }
  }

  // 新規従業員を登録し、採番後の行を返す。
  async create(newEmployee: NewEmployee): Promise<Employee | Error> {
    try {
      const rows = await this.c.var.database
        .insert(employees)
        .values({
          code: newEmployee.code,
          name: newEmployee.name,
          email: newEmployee.email,
          passwordHash: newEmployee.passwordHash,
          role: newEmployee.role,
          deptId: newEmployee.deptId,
          deptName: newEmployee.deptName,
          position: newEmployee.position,
          status: newEmployee.status,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined ? new Error("failed to insert employee") : Employee.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("employee unique constraint violated", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to insert employee")
    }
  }

  // 氏名・メール・ロール・部署・役職・在籍状況を更新する。code と認証情報には触れない。
  async updateProfile(employee: Employee): Promise<Employee | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(employees)
        .set({
          name: employee.name,
          email: employee.email,
          role: employee.role,
          deptId: employee.deptId,
          deptName: employee.deptName,
          position: employee.position,
          status: employee.status,
        })
        .where(eq(employees.code, employee.code))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : Employee.fromRow(row)
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("employee unique constraint violated", {
          cause: error,
        })
      }

      return error instanceof Error ? error : new Error("failed to update employee")
    }
  }

  // パスワードハッシュのみ差し替える。旧フォーマット → 新フォーマット段階移行に使う。
  async updatePasswordHash(employeeId: number, newPasswordHash: string): Promise<null | Error> {
    try {
      await this.c.var.database
        .update(employees)
        .set({ passwordHash: newPasswordHash })
        .where(eq(employees.id, employeeId))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update password hash")
    }
  }

  // 従業員を削除する。
  async delete(code: string): Promise<null | Error> {
    try {
      await this.c.var.database.delete(employees).where(eq(employees.code, code))

      return null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete employee")
    }
  }
}
