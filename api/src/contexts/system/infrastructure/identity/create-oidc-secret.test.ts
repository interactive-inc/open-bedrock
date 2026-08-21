import { createOidcSecret } from "@system/infrastructure/identity/create-oidc-secret.repository"
import { expect, test } from "bun:test"

test("256bit secretを43文字のpaddingなしbase64urlで生成する", () => {
  expect(createOidcSecret()).toMatch(/^[A-Za-z0-9_-]{43}$/)
})
