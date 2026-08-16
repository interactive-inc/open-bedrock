import {
  resolveActiveSystemAccountId,
  toSystemAccountId,
} from "@/contexts/company/application/iam/to-system-account-id"
import { createTestContext } from "@/contexts/company/interface/test-helpers/create-test-context"
import { describe, expect, test } from "bun:test"
import { zAccountId } from "@system/domain/auth/account-id"

describe("legacy Session to canonical System Account adapter", () => {
  test("safe non-negative integerだけをdigit-only opaque IDへ投影する", () => {
    expect(toSystemAccountId(42)).toBe(zAccountId.parse("42"))
    expect(toSystemAccountId(-1)).toBeInstanceOf(Error)
    expect(toSystemAccountId(1.5)).toBeInstanceOf(Error)
    expect(toSystemAccountId(Number.MAX_SAFE_INTEGER + 1)).toBeInstanceOf(Error)
  })

  test("canonical Accountがactiveな場合だけcommand actorとして解決する", async () => {
    const { context, db } = createTestContext()
    await db
      .prepare(
        `INSERT INTO accounts (id, status, token_version, created_at, updated_at)
         VALUES (501, 'active', 0, 0, 0)`,
      )
      .run()

    expect(await resolveActiveSystemAccountId(context, 501)).toBe(zAccountId.parse("501"))

    await db
      .prepare(
        `UPDATE system_accounts
         SET status = 'locked', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = '501'`,
      )
      .run()

    expect(await resolveActiveSystemAccountId(context, 501)).toBeInstanceOf(Error)
    expect(await resolveActiveSystemAccountId(context, 999)).toBeInstanceOf(Error)
  })
})
