import { OrgDepartment } from "@/domain/org/org-department.entity"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { abortWhenPreviousStatementChangedNoRows, isAbortedByGuard } from "@/lib/d1/batch-abort-guard"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { orgDepartments, orgMemberships } from "@/schema"
import { asc, eq } from "drizzle-orm"

export type ParentNotFound = { reason: "parent_not_found" }

export class OrgDepartmentRepository {
  constructor(private readonly c: Context) {}

  // 部署ノードを表示順の昇順で返す。
  async findAll(): Promise<ReadonlyArray<OrgDepartment> | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(orgDepartments)
        .orderBy(asc(orgDepartments.sortOrder))

      return rows.map((row) => OrgDepartmentRepository.toEntity(row))
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load org_departments")
    }
  }

  // 部署コードで1件取得する。存在しなければ null。
  async findByCode(code: string): Promise<OrgDepartment | null | Error> {
    try {
      const rows = await this.c.var.database
        .select()
        .from(orgDepartments)
        .where(eq(orgDepartments.code, code))
        .limit(1)

      const row = rows.at(0)

      return row === undefined ? null : OrgDepartmentRepository.toEntity(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to load org_department")
    }
  }

  // 親コードを持つ部署が存在するかを返す。削除時の子ノード検査に使う。
  async hasChildren(parentCode: string): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ code: orgDepartments.code })
        .from(orgDepartments)
        .where(eq(orgDepartments.parentCode, parentCode))
        .limit(1)

      return rows.length > 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count child org_departments")
    }
  }

  // 部署に所属するメンバーが存在するかを返す。削除時の所属検査に使う。
  async hasMembers(code: string): Promise<boolean | Error> {
    try {
      const rows = await this.c.var.database
        .select({ employeeCode: orgMemberships.employeeCode })
        .from(orgMemberships)
        .where(eq(orgMemberships.departmentCode, code))
        .limit(1)

      return rows.length > 0
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to count org_memberships")
    }
  }

  async create(department: OrgDepartment): Promise<OrgDepartment | ParentNotFound | Error> {
    // parentCode が指定されている場合は INSERT ... SELECT ... WHERE EXISTS で
    // 親の存在をアトミックに検証する（TOCTOU 対策: ensureParentExists 後に親が削除されるケース）。
    if (department.parentCode !== null) {
      return this.createWithParentGuard(department)
    }

    try {
      const rows = await this.c.var.database
        .insert(orgDepartments)
        .values({
          code: department.code,
          departmentId: department.departmentId,
          parentCode: department.parentCode,
          managerEmployeeCode: department.managerEmployeeCode,
          sortOrder: department.order,
        })
        .returning()

      const row = rows.at(0)

      return row === undefined
        ? new Error("failed to insert org_department")
        : OrgDepartmentRepository.toEntity(row)
    } catch (error) {
      // (code) の UNIQUE 制約違反 = 並行リクエストによる二重登録。
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("department code already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to insert org_department")
    }
  }

  /**
   * 親コードの存在を INSERT と同一ステートメントで検証する。
   * 0 行挿入 = 親が存在しない → { reason: "parent_not_found" } を返す。
   */
  private async createWithParentGuard(
    department: OrgDepartment,
  ): Promise<OrgDepartment | ParentNotFound | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `INSERT INTO org_departments (code, department_id, parent_code, manager_employee_code, sort_order)
         SELECT ?1, ?2, ?3, ?4, ?5
         WHERE EXISTS (SELECT 1 FROM org_departments WHERE code = ?3)`,
      )
        .bind(
          department.code,
          department.departmentId,
          department.parentCode,
          department.managerEmployeeCode,
          department.order,
        )
        .run()

      if (result.meta.changes === 0) {
        return { reason: "parent_not_found" }
      }

      // INSERT ... SELECT は RETURNING を使えないため再取得する。
      const created = await this.findByCode(department.code)

      if (created instanceof Error) {
        return created
      }

      return created ?? new Error("failed to read inserted org_department")
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return new UniqueConstraintError("department code already exists", { cause: error })
      }

      return error instanceof Error ? error : new Error("failed to insert org_department")
    }
  }

  // 親・部署マスタ・責任者・表示順を更新する。コードは主キーなので変更しない。
  async update(department: OrgDepartment): Promise<OrgDepartment | null | Error> {
    try {
      const rows = await this.c.var.database
        .update(orgDepartments)
        .set({
          departmentId: department.departmentId,
          parentCode: department.parentCode,
          managerEmployeeCode: department.managerEmployeeCode,
          sortOrder: department.order,
        })
        .where(eq(orgDepartments.code, department.code))
        .returning()

      const row = rows.at(0)

      return row === undefined ? null : OrgDepartmentRepository.toEntity(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to update org_department")
    }
  }

  // 子ノード・所属メンバーが存在しない場合のみ部署ノードを削除する。
  // D1 batch でチェックと削除をアトミックに実行し TOCTOU を防ぐ。
  // 0 行削除（子 or メンバーが存在）なら null を返す。
  async delete(code: string): Promise<true | null | Error> {
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `DELETE FROM org_departments
           WHERE code = ?1
             AND NOT EXISTS (SELECT 1 FROM org_departments WHERE parent_code = ?1)
             AND NOT EXISTS (SELECT 1 FROM org_memberships WHERE department_code = ?1)`,
        ).bind(code),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ])

      return true
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return null
      }
      return error instanceof Error ? error : new Error("failed to delete org_department")
    }
  }

  private static toEntity(row: typeof orgDepartments.$inferSelect): OrgDepartment {
    return new OrgDepartment({
      code: row.code,
      departmentId: row.departmentId,
      parentCode: row.parentCode,
      managerEmployeeCode: row.managerEmployeeCode,
      order: row.sortOrder,
    })
  }
}