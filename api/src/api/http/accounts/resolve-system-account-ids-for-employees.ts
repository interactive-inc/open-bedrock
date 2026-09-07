import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

export async function resolveSystemAccountIdsForEmployees(
  c: Context,
  employeeIds: ReadonlyArray<EmployeeId>,
): Promise<ReadonlyArray<AccountId> | Error> {
  if (employeeIds.length === 0) return []
  try {
    const links = await new CompanyAccountEmployeeLinksReadAdapter(c).findMany({ employeeIds })
    if (links instanceof Error) return links
    const accountIds: AccountId[] = []
    for (const row of links) {
      const accountId = zAccountId.safeParse(row.accountId)
      if (!accountId.success) return new Error("Company link contains an invalid Account ID")
      accountIds.push(accountId.data)
    }
    return accountIds
  } catch (cause) {
    return cause instanceof Error
      ? cause
      : new Error("failed to resolve Employee Account IDs", { cause })
  }
}
