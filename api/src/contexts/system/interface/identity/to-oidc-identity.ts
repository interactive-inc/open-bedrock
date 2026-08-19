import type { OidcIdentity } from "@/contexts/system/infrastructure/identity/oidc-id-token.service"
import type { userIdentities, users } from "@/contexts/system/infrastructure/schema/system-runtime"

type UserRow = Pick<typeof users.$inferSelect, "id" | "disabledAt">
type IdentityRow = Pick<typeof userIdentities.$inferSelect, "email" | "emailVerifiedAt">

export function toOidcIdentity(
  user: UserRow | undefined,
  identities: ReadonlyArray<IdentityRow>,
): OidcIdentity | null {
  if (user === undefined || user.disabledAt !== null) {
    return null
  }

  const primary = identities.find((identity) => identity.email !== null)

  return {
    subject: user.id,
    email: primary?.email ?? null,
    emailVerified: primary?.emailVerifiedAt !== null && primary?.emailVerifiedAt !== undefined,
  }
}
