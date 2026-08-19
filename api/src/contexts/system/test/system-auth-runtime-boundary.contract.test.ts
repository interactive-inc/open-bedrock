import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import * as systemRuntimeSchema from "@system/infrastructure/schema/system-runtime"
import { Glob } from "bun"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

describe("System authentication runtime boundary", () => {
  test("canonical Sessionと認証table以外の旧runtimeを公開しない", () => {
    expect(systemCoreSchema).toHaveProperty("systemSessions")
    expect(systemCoreSchema).toHaveProperty("systemPasswordResetChallenges")
    expect(systemCoreSchema).toHaveProperty("systemAuthenticationAttempts")
    expect(systemRuntimeSchema).not.toHaveProperty("passwordResetTokens")
    expect(systemRuntimeSchema).not.toHaveProperty("loginAttempts")
  })

  test("System production sourceに旧JWT Sessionと旧table経路を再導入しない", () => {
    const contextDirectory = new URL("../", import.meta.url)
    const legacyPattern =
      /verifyLegacy|SessionTokenService|MobileSessionTokenService|AccountTokenCollectionValue|passwordResetTokens|loginAttempts|password_reset_tokens|login_attempts/
    const violations = [...new Glob("**/*.ts").scanSync({ cwd: contextDirectory.pathname })]
      .filter((path) => !path.endsWith(".test.ts") && !path.startsWith("test/"))
      .filter((path) => legacyPattern.test(readFileSync(new URL(path, contextDirectory), "utf8")))

    expect(violations).toEqual([])
  })
})
