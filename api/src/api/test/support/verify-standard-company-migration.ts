import { verifyCompanyMigration } from "@/api/test/support/verify-company-migration"
import { seedDepartments } from "@/contexts/company/infrastructure/seed/seed-departments"
import { seedOrgDepartments } from "@/contexts/company/infrastructure/seed/seed-org-departments"

/** 標準Company seedの組織定義を補い、本番と同じmigrationを完了する。 */
export async function verifyStandardCompanyMigration(db: D1Database): Promise<void> {
  for (const department of seedDepartments) {
    await db
      .prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?1, ?2)")
      .bind(department.id, department.name)
      .run()
  }
  for (const department of seedOrgDepartments) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO org_departments
           (code, department_id, parent_code, manager_employee_code, sort_order)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
      .bind(
        department.code,
        department.departmentId,
        department.parentCode,
        department.managerEmployeeCode,
        department.order,
      )
      .run()
  }
  await verifyCompanyMigration(db)
}
