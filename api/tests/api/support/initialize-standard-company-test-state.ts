import { seedDepartments } from "@tests/api/support/company/seed-departments.test-support"
import { seedEmployees } from "@tests/api/support/company/seed-employees.test-support"
import { seedOrgDepartments } from "@tests/api/support/company/seed-org-departments.test-support"
import { seedOrgMemberships } from "@tests/api/support/company/seed-org-memberships.test-support"
import {
  seedCompanyEmployees,
  seedCompanyOrganization,
  type CompanyMembershipFixture,
} from "@tests/api/support/company/seed-company-test-state"
import { seedIamForEmployees } from "@tests/api/support/seed-iam-for-employees"

type Options = Readonly<{ memberships?: ReadonlyArray<CompanyMembershipFixture> }>

function membershipKey(membership: CompanyMembershipFixture): string {
  return `${membership.departmentCode}:${membership.employeeCode}`
}

/** 標準Company fixtureをcanonical Employee・Employment・Organizationへ直接初期化する。 */
export async function initializeStandardCompanyTestState(
  db: D1Database,
  options: Options = {},
): Promise<void> {
  const departments = seedOrgDepartments.map((organization) => ({
    id: organization.departmentId,
    code: organization.code,
    name:
      seedDepartments.find((department) => department.id === organization.departmentId)?.name ??
      organization.code,
    parentCode: organization.parentCode,
    managerEmployeeCode: organization.managerEmployeeCode,
  }))
  const memberships = new Map(
    [...seedOrgMemberships, ...(options.memberships ?? [])].map((membership) => [
      membershipKey(membership),
      membership,
    ]),
  )

  await seedCompanyEmployees(db, seedEmployees)
  const organizationInitialized =
    ((await db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM company_organization_unit_period_versions
         WHERE period_id LIKE 'test:department:%'`,
      )
      .first<number>("count")) ?? 0) > 0
  if (!organizationInitialized) {
    await seedCompanyOrganization(db, {
      employees: seedEmployees,
      departments,
      memberships: [...memberships.values()],
    })
  }
  await seedIamForEmployees(db)
}

/** 標準fixtureへ明示したreporting lineを上書きしてcanonical組織を初期化する。 */
export async function initializeCompanyMembershipTestState(
  db: D1Database,
  memberships: ReadonlyArray<CompanyMembershipFixture>,
): Promise<void> {
  await initializeStandardCompanyTestState(db, { memberships })
}
