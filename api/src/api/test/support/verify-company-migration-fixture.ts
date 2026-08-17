import { seedD1 } from "@/api/test/support/seed-d1"
import { verifyCompanyMigration } from "@/api/test/support/verify-company-migration"

type DepartmentFixture = {
  id: number
  code: string
  name: string
  parentCode?: string | null
  managerEmployeeCode?: string | null
}

type Props = {
  db: D1Database
  departments: ReadonlyArray<DepartmentFixture>
}

/** 小規模fixtureの旧部署構造を明示し、本番と同じCompany migrationを完了する。 */
export async function verifyCompanyMigrationFixture(props: Props): Promise<void> {
  await seedD1(
    props.db,
    "departments",
    props.departments.map((department) => ({ id: department.id, name: department.name })),
  )
  await seedD1(
    props.db,
    "org_departments",
    props.departments.map((department, index) => ({
      code: department.code,
      department_id: department.id,
      parent_code: department.parentCode ?? null,
      manager_employee_code: department.managerEmployeeCode ?? null,
      sort_order: index + 1,
    })),
  )
  for (const department of props.departments) {
    await props.db
      .prepare("UPDATE employees SET dept_name = ?1 WHERE dept_id = ?2")
      .bind(department.name, department.id)
      .run()
  }
  await verifyCompanyMigration(props.db)
}
