import { identityProviderSchema } from "@/domain/system/auth/identity-provider"
import { describe, expect, test } from "bun:test"

describe("identityProviderSchema", () => {
  test.each(["password", "google", "github", "oidc"] as const)(
    "accepts the supported provider %s",
    (provider) => {
      expect(identityProviderSchema.parse(provider)).toBe(provider)
    },
  )

  test.each(["", "Password", "saml", "oidc "])("rejects unsupported provider %s", (provider) => {
    expect(identityProviderSchema.safeParse(provider).success).toBe(false)
  })
})
