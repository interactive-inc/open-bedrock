import type { AccountRepository } from "@system/application/auth/account-repository"
import { resolveAccountSession } from "@system/application/auth/resolve-account-session"
import { zAccountId } from "@system/domain/auth/account-id"
import { Account } from "@system/domain/auth/account.entity"
import { describe, expect, test } from "bun:test"

const accountId = zAccountId.parse("account-1")

function repository(
  account: Awaited<ReturnType<AccountRepository["findById"]>>,
): AccountRepository {
  return { findById: async () => account }
}

function account(status: "active" | "suspended" | "locked", tokenVersion: number) {
  return Account.create({
    id: accountId,
    status,
    tokenVersion,
    createdAt: new Date(100),
    updatedAt: new Date(200),
  })
}

describe("resolveAccountSession", () => {
  test("active Accountと同じtoken versionのSessionを許可する", async () => {
    const resolved = await resolveAccountSession({
      accountRepository: repository(account("active", 3)),
      accountId,
      sessionTokenVersion: 3,
    })

    expect(resolved).toMatchObject({ kind: "accepted", account: { id: accountId } })
  })

  test.each([
    ["suspended", 3, 3, "account_inactive"],
    ["locked", 3, 3, "account_inactive"],
    ["active", 4, 3, "token_version_mismatch"],
  ] as const)(
    "canonical AccountがSessionを拒否する理由を維持する",
    async (status, accountTokenVersion, sessionTokenVersion, reason) => {
      const resolved = await resolveAccountSession({
        accountRepository: repository(account(status, accountTokenVersion)),
        accountId,
        sessionTokenVersion,
      })

      expect(resolved).toEqual({ kind: "rejected", reason })
    },
  )

  test("canonical Accountが存在しなければ拒否する", async () => {
    const resolved = await resolveAccountSession({
      accountRepository: repository(null),
      accountId,
      sessionTokenVersion: 0,
    })

    expect(resolved).toEqual({ kind: "rejected", reason: "account_not_found" })
  })

  test("repository Errorを認証拒否へ畳まず呼出元へ返す", async () => {
    const readError = new Error("database unavailable")
    const resolved = await resolveAccountSession({
      accountRepository: repository(readError),
      accountId,
      sessionTokenVersion: 0,
    })

    expect(resolved).toBe(readError)
  })
})
