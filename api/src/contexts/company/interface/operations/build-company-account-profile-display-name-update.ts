import { companyAccountProfiles } from "@/contexts/company/infrastructure/schema/company"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { and, eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"

/** 既存の会社上の表示名だけを指定の値へ変える文を返す公開境界。行が無ければ何も変えない。 */
export function buildCompanyAccountProfileDisplayNameUpdate(
  database: Pick<DrizzleD1Database, "update">,
  input: Readonly<{ accountId: string; displayName: string; updatedAt: Date }>,
) {
  return database
    .update(companyAccountProfiles)
    .set({ displayName: input.displayName, updatedAt: input.updatedAt.getTime() })
    .where(
      and(
        eq(companyAccountProfiles.organizationId, "organization:default"),
        eq(companyAccountProfiles.accountId, zAccountId.parse(input.accountId)),
      ),
    )
}
