import { EmployeeCertification } from "@/contexts/company/domain/certification/employee-certification.entity"
import type { Context } from "@/env"
import { employeeCertifications } from "@/schema"
import { and, desc, eq } from "drizzle-orm"

export class EmployeeCertificationRepository {
  constructor(private readonly c: Context) {}

  /** 従業員の資格保有記録を取得日の降順で返す。 */
  async findByEmployeeId(
    employeeId: number,
  ): Promise<ReadonlyArray<EmployeeCertification> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeCertifications)
        .where(eq(employeeCertifications.employeeId, employeeId))
        .orderBy(desc(employeeCertifications.acquiredOn))

      return rows.map((row) => EmployeeCertification.fromRow(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee_certifications")
    }
  }

  /** id で 1 件取得する。存在しなければ null。 */
  async findById(id: number): Promise<EmployeeCertification | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(employeeCertifications)
        .where(eq(employeeCertifications.id, id))

      const row = rows.at(0)

      return row === undefined ? null : EmployeeCertification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee_certification")
    }
  }

  /**
   * 保有記録を INSERT する。(employee_id, certification_id, acquired_on) は UNIQUE 制約があり、
   * 重複時は null を返す。それ以外の失敗は Error。
   */
  async create(props: {
    employeeId: number
    certificationId: number
    acquiredOn: string
    expiresOn: string | null
    note: string | null
    createdAt: string
  }): Promise<EmployeeCertification | null | Error> {
    try {
      const rows = await this.c.var.database
        .insert(employeeCertifications)
        .values({
          employeeId: props.employeeId,
          certificationId: props.certificationId,
          acquiredOn: props.acquiredOn,
          expiresOn: props.expiresOn,
          note: props.note,
          createdAt: props.createdAt,
        })
        .onConflictDoNothing()
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : EmployeeCertification.fromRow(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to save employee_certification")
    }
  }

  /** 保有記録を削除する。0 行削除（対象なし）なら null を返す。 */
  async delete(id: number): Promise<true | null | Error> {
    try {
      const rows = await this.c.var.database
        .delete(employeeCertifications)
        .where(eq(employeeCertifications.id, id))
        .returning({ id: employeeCertifications.id })

      return rows.length > 0 ? true : null
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete employee_certification")
    }
  }

  /** 従業員 x 資格の保有記録が既に存在するか（重複チェック補助）。 */
  async existsForEmployeeCertification(props: {
    employeeId: number
    certificationId: number
    acquiredOn: string
  }): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ id: employeeCertifications.id })
        .from(employeeCertifications)
        .where(
          and(
            eq(employeeCertifications.employeeId, props.employeeId),
            eq(employeeCertifications.certificationId, props.certificationId),
            eq(employeeCertifications.acquiredOn, props.acquiredOn),
          ),
        )

      return rows.length > 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load employee_certification")
    }
  }
}
