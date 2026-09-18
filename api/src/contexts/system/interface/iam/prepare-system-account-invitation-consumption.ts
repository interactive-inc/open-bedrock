import { systemAccountInvitations, systemIamRoles } from "@system/infrastructure/schema/system-core"
import { and, eq, gt, isNull, sql, type SQL } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

/** 招待の既読snapshotと現在のRoleを再検査する、原子的な受諾更新を準備する。 */
export function prepareSystemAccountInvitationConsumption(
  database: D1Database,
  input: Readonly<{
    id: string
    storedToken: string
    expectedEmail: string | null
    roleId: string
    expectedUpdatedAt: Date
    expectedExpiresAt: Date
    expectedRoleUpdatedAt: Date
    expectedRoleResourceType: string | null
    acceptedByAccountId: string
    consumedAt: Date
    /** 他contextの条件はSystemの条件へANDで追加し、緩和できない。 */
    additionalConditions: ReadonlyArray<SQL>
  }>,
) {
  if (
    input.id.length < 1 ||
    input.id.length > 255 ||
    input.storedToken.length < 1 ||
    input.storedToken.length > 255 ||
    input.roleId.length < 1 ||
    input.roleId.length > 255 ||
    input.acceptedByAccountId.length < 1 ||
    input.acceptedByAccountId.length > 255 ||
    [
      input.expectedUpdatedAt,
      input.expectedExpiresAt,
      input.expectedRoleUpdatedAt,
      input.consumedAt,
    ].some((date) => !Number.isSafeInteger(date.getTime()))
  ) {
    return new Error("Invalid System account invitation consumption")
  }

  return drizzle(database)
    .update(systemAccountInvitations)
    .set({ usedBy: input.acceptedByAccountId, updatedAt: input.consumedAt })
    .where(
      and(
        eq(systemAccountInvitations.id, input.id),
        eq(systemAccountInvitations.token, input.storedToken),
        sql`${systemAccountInvitations.email} IS ${input.expectedEmail}`,
        eq(systemAccountInvitations.roleId, input.roleId),
        eq(systemAccountInvitations.updatedAt, input.expectedUpdatedAt),
        eq(systemAccountInvitations.expiresAt, input.expectedExpiresAt),
        isNull(systemAccountInvitations.usedBy),
        isNull(systemAccountInvitations.revokedAt),
        gt(systemAccountInvitations.expiresAt, input.consumedAt),
        sql`EXISTS (SELECT 1 FROM ${systemIamRoles} WHERE ${and(
          eq(systemIamRoles.id, input.roleId),
          eq(systemIamRoles.updatedAt, input.expectedRoleUpdatedAt),
          sql`${systemIamRoles.resourceType} IS ${input.expectedRoleResourceType}`,
        )})`,
        ...input.additionalConditions,
      ),
    )
}
