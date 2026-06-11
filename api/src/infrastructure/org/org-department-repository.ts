import { OrgDepartment } from "@/domain/org/org-department"
import type { Context } from "@/env"
import { isUniqueConstraintError } from "@/infrastructure/shared/is-unique-constraint-error"
import { UniqueConstraintError } from "@/infrastructure/shared/unique-constraint-error"
import { orgDepartments, orgMemberships } from "@/schema"
import { asc, eq } from "drizzle-orm"

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

  async create(department: OrgDepartment): Promise<OrgDepartment | Error> {
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

  // 部署ノードを削除する。子ノード・所属の検査は呼び出し側で行う。
  async delete(code: string): Promise<null | Error> {
    try {
      await this.c.var.database.delete(orgDepartments).where(eq(orgDepartments.code, code))

      return null
    } catch (error) {
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
