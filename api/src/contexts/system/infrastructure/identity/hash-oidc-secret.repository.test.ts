import { hashOidcSecret } from "@system/infrastructure/identity/hash-oidc-secret.repository"
import { expect, test } from "bun:test"

test("secretを64文字のSHA-256 hexへ変換する", async () => {
  expect(await hashOidcSecret("secret")).toMatch(/^[a-f0-9]{64}$/)
})
