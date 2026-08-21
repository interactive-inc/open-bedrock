import { seedD1 } from "@/api/test/support/seed-d1"
import { initializeCompanyTestState } from "@/api/test/support/initialize-company-test-state"

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

/** 小規模fixtureの部署構造を明示し、canonical Company状態を初期化する。 */
export async function initializeCompanyTestFixture(props: Props): Promise<void> {
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
  await initializeCompanyTestState(props.db)
}
