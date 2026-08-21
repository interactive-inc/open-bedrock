import { SessionIssueTimeValue } from "@system/domain/values/session-issue-time.value"
import { describe, expect, test } from "bun:test"

describe("SessionIssueTimeValue", () => {
  test("revokes a session issued before a password change", () => {
    const passwordChangedAt = new Date("2026-01-01T00:00:00.500Z")

    expect(
      SessionIssueTimeValue.restore({
        issuedAtSeconds: 1_767_225_600,
        issuedAtMs: 1_767_225_600_499,
      }).isRevokedByPasswordChange(passwordChangedAt),
    ).toBe(true)
    expect(
      SessionIssueTimeValue.restore({
        issuedAtSeconds: 1_767_225_600,
        issuedAtMs: 1_767_225_600_501,
      }).isRevokedByPasswordChange(passwordChangedAt),
    ).toBe(false)
  })

  test("fails closed for a legacy token without issue time only after a password change", () => {
    const issuedAt = SessionIssueTimeValue.restore({ issuedAtSeconds: null })

    expect(issuedAt.isRevokedByPasswordChange(new Date())).toBe(true)
    expect(issuedAt.isRevokedByPasswordChange(null)).toBe(false)
  })

  test("refreshes an old session and a legacy token without issue time", () => {
    expect(
      SessionIssueTimeValue.restore({ issuedAtSeconds: null, issuedAtMs: 1_000 }).shouldRefresh(
        2_000,
        1,
      ),
    ).toBe(true)
    expect(
      SessionIssueTimeValue.restore({ issuedAtSeconds: null, issuedAtMs: null }).shouldRefresh(
        2_000,
        1,
      ),
    ).toBe(true)
  })
})
