import type { Context } from "@/env"
import { EmployeeRepository } from "@/contexts/company/infrastructure/employee/employee.repository"
import { seedIamForEmployees } from "@/api/test/support/seed-iam-for-employees"
import { zAccountId, type AccountId } from "@/contexts/system/domain/auth/account-id"

export async function seedIamTestAccount(
  context: Context,
  code: string,
  systemRole: string = "member",
): Promise<AccountId> {
  const created = await new EmployeeRepository(context).create({
    code: code,
    name: "Sam Rivers",
    deptId: 3,
    deptName: "Engineering",
    position: "Engineer",
    status: "active",
  })

  if (created instanceof Error) {
    throw created
  }

  await seedIamForEmployees(context.env.DB, [
    {
      id: created.id,
      email: `you+${code.toLowerCase()}@example.com`,
      passwordHash: "hash",
      role: systemRole,
    },
  ])

  return zAccountId.parse(String(created.id))
}
