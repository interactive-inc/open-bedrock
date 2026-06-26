import { Employee } from "@/domain/employee/employee.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { employees } from "@/schema"
import { eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

// 新規従業員の登録に必要な値。id は DB が採番するため含めない。
// 認証(email/password)・認可(role)は employees ではなく IAM(identities/account_roles)が正。
export type NewEmployee = {
  code: string
  name: string
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

  private async findOne(condition: SQL): Promise<Employee | null | Error> {
    try {
      const rows = await this.c.var.database.select().from(employees).where(condition).limit(1)

      const row = rows.at(0)

      return row === undefined ? null : Employee.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee")
    }
  }

  // 新規従業員を登録し、採番後の行を返す。認証情報は AccountProvisioner が別途払い出す。
  async create(newEmployee: NewEmployee): Promise<Employee | Error> {
    try {
      const rows = await this.c.var.database
        .insert(employees)
        .values({
          code: newEmployee.code,
          name: newEmployee.name,
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

  // 氏名・部署・役職・在籍状況を更新する。code と認証・認可情報には触れない。
  async updateProfile(employee: Employee): Promise<Employee | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(employees)
        .set({
          name: employee.name,
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
