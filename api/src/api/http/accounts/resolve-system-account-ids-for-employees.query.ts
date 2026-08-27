import type { Context } from "@/env"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

export async function resolveSystemAccountIdsForEmployees(
  c: Context,
  employeeIds: ReadonlyArray<number>,
): Promise<ReadonlyArray<AccountId> | Error> {
  if (employeeIds.length === 0) return []
  try {
    const unique = [...new Set(employeeIds)]
    const placeholders = unique.map((_, index) => `?${index + 1}`).join(", ")
    const rows = await c.env.DB.prepare(
      `SELECT account_id
       FROM account_employee_links
       WHERE employee_id IN (${placeholders})`,
    )
      .bind(...unique)
      .all<{ account_id: string }>()
    const accountIds: AccountId[] = []
    for (const row of rows.results) {
      const accountId = zAccountId.safeParse(row.account_id)
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
