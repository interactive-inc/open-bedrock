import { describe, expect, test } from "bun:test"
import { resolveExistingAccountTokens } from "@/contexts/system/infrastructure/auth/resolve-existing-account-tokens"
import { SessionTokenService } from "@/contexts/system/infrastructure/auth/session-token.service"

const SECRET = "test-secret"

describe("resolveExistingAccountTokens", () => {
  test("有効なWeb sessionだけをuserId付きで返す", async () => {
    const valid = await SessionTokenService.create("user-1", SECRET, 0)

    expect(await resolveExistingAccountTokens(`${valid},broken-token`, SECRET)).toEqual([
      { userId: "user-1", token: valid },
    ])
  })
})
