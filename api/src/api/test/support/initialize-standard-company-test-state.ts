import { initializeCompanyTestState } from "@/api/test/support/initialize-company-test-state"
import { seedDepartments } from "@/api/test/support/company/seed-departments.test-support"
import { seedOrgDepartments } from "@/api/test/support/company/seed-org-departments.test-support"

/** 標準Company fixtureの組織定義を補い、canonical Company状態を初期化する。 */
export async function initializeStandardCompanyTestState(db: D1Database): Promise<void> {
  for (const department of seedDepartments) {
    await db
      .prepare("INSERT OR IGNORE INTO departments (id, name) VALUES (?1, ?2)")
      .bind(department.id, department.name)
      .run()
  }
  for (const department of seedOrgDepartments) {
    const managerEmployeeCode =
      department.managerEmployeeCode === null
        ? null
        : await db
            .prepare("SELECT code FROM employees WHERE code = ?1")
            .bind(department.managerEmployeeCode)
            .first<string>("code")
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
        managerEmployeeCode,
        department.order,
      )
      .run()
  }
  await initializeCompanyTestState(db)
}
