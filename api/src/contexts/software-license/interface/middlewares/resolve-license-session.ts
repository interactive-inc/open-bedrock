import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SoftwareLicenseUnavailableError } from "@/contexts/software-license/interface/errors"

/** 認証済みAccountに、その営業日の在籍従業員が対応する場合だけ記録者資格を付ける。 */
export const resolveLicenseSession = softwareLicenseFactory.createMiddleware(async (c, next) => {
  const accountId = zAccountId.parse(c.var.userId)
  const directory = await new CompanyEmployeeDirectoryReadAdapter({
    env: {
      ...c.env,
      NOW: c.var.now().toISOString(),
    },
  }).findForAccountIds([accountId])
  if (directory instanceof Error)
    throw new SoftwareLicenseUnavailableError({ message: "Company directory is unavailable" })
  const employee = directory[0]?.employee
  c.set("licenseSession", null)
  if (
    employee?.employment !== null &&
    employee?.employment !== undefined &&
    employee.employment.status !== "TERMINATED"
  ) {
    c.set(
      "licenseSession",
      new CompanySessionValue({
        accountId,
        employeeId: employee.id,
        employmentStatus: employee.employment.status,
        permissions: c.var.permissions,
        roleKeys: c.var.roleKeys ?? [],
      }),
    )
  }
  await next()
})
