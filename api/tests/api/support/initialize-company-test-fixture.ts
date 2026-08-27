import {
  seedCompanyTestState,
  type CompanyEmployeeFixture,
  type CompanyMembershipFixture,
} from "@tests/api/support/company/seed-company-test-state"

type DepartmentFixture = {
  id: number
  code: string
  name: string
  parentCode?: string | null
  managerEmployeeCode?: string | null
}

type Props = {
  db: D1Database
  employees: ReadonlyArray<CompanyEmployeeFixture>
  departments: ReadonlyArray<DepartmentFixture>
  memberships?: ReadonlyArray<CompanyMembershipFixture>
}

/** 小規模fixtureの部署構造を明示し、canonical Company状態を初期化する。 */
export async function initializeCompanyTestFixture(props: Props): Promise<void> {
  await seedCompanyTestState(props.db, {
    employees: props.employees.map((employee) => ({
      ...employee,
      deptName:
        employee.deptId === undefined || employee.deptId === null
          ? null
          : (props.departments.find((department) => department.id === employee.deptId)?.name ??
            null),
    })),
    departments: props.departments,
    memberships: props.memberships,
  })
}
