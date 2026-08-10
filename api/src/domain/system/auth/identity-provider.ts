import { z } from "zod"

/** Identity の認証方式。password 以外は OAuth/OIDC の拡張点。 */
export const identityProviderSchema = z.enum(["password", "google", "github", "oidc"])

export type IdentityProvider = z.infer<typeof identityProviderSchema>
