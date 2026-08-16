import {
  ResolveAccountEmployeeLink,
  type AccountEmployeeLinkQuery,
  type AccountEmployeeLinkReadPort,
  type AccountEmployeeLinkReadPortResult,
} from "@/contexts/company/application/workforce/resolve-account-employee-link"
import { restoreWorkforceId } from "@/contexts/company/domain/workforce/workforce-id"
import { describe, expect, test } from "bun:test"

const accountId = restoreWorkforceId("system_account", "account-1")
const employeeId = restoreWorkforceId("employee", "employee-1")
const otherAccountId = restoreWorkforceId("system_account", "account-2")
const otherEmployeeId = restoreWorkforceId("employee", "employee-2")
const link = { accountId, employeeId }

class StubPort implements AccountEmployeeLinkReadPort {
  constructor(
    private readonly result: AccountEmployeeLinkReadPortResult | Error,
    private readonly throws = false,
  ) {}

  async find(_query: AccountEmployeeLinkQuery): Promise<AccountEmployeeLinkReadPortResult> {
    if (this.throws) throw this.result
    return this.result as AccountEmployeeLinkReadPortResult
  }
}

describe("ResolveAccountEmployeeLink", () => {
  test.each([
    { query: { kind: "by_account" as const, accountId }, expected: link },
    { query: { kind: "by_employee" as const, employeeId }, expected: link },
  ])("resolves the single eligible link for $query.kind", async ({ query, expected }) => {
    const result = await new ResolveAccountEmployeeLink(
      new StubPort({ ok: true, records: [{ link, accountEligible: true }] }),
    ).execute(query)

    expect(result).toEqual({ kind: "found", link: expected })
  })

  test("distinguishes a missing link", async () => {
    const result = await new ResolveAccountEmployeeLink(
      new StubPort({ ok: true, records: [] }),
    ).execute({ kind: "by_account", accountId })

    expect(result).toEqual({ kind: "not_found" })
  })

  test("rejects a link to an ineligible System Account", async () => {
    const result = await new ResolveAccountEmployeeLink(
      new StubPort({ ok: true, records: [{ link, accountEligible: false }] }),
    ).execute({ kind: "by_employee", employeeId })

    expect(result).toEqual({ kind: "ineligible" })
  })

  test("rejects ambiguous rows even when they contain the same link", async () => {
    const record = { link, accountEligible: true }
    const result = await new ResolveAccountEmployeeLink(
      new StubPort({ ok: true, records: [record, record] }),
    ).execute({ kind: "by_account", accountId })

    expect(result).toEqual(
      expect.objectContaining({
        kind: "invalid_link",
        error: expect.objectContaining({ code: "account_link_ambiguous" }),
      }),
    )
  })

  test.each([
    {
      query: { kind: "by_account" as const, accountId },
      mismatchedLink: { accountId: otherAccountId, employeeId },
      code: "account_link_account_mismatch",
    },
    {
      query: { kind: "by_employee" as const, employeeId },
      mismatchedLink: { accountId, employeeId: otherEmployeeId },
      code: "account_link_employee_mismatch",
    },
  ])("rejects a $code result", async ({ query, mismatchedLink, code }) => {
    const result = await new ResolveAccountEmployeeLink(
      new StubPort({ ok: true, records: [{ link: mismatchedLink, accountEligible: true }] }),
    ).execute(query)

    expect(result).toEqual(
      expect.objectContaining({
        kind: "invalid_link",
        error: expect.objectContaining({ code }),
      }),
    )
  })

  test.each([
    { result: { ok: false as const, cause: new Error("read failed") }, throws: false },
    { result: new Error("port threw"), throws: true },
  ])("returns unavailable when the port cannot be evaluated", async ({ result, throws }) => {
    const resolved = await new ResolveAccountEmployeeLink(new StubPort(result, throws)).execute({
      kind: "by_account",
      accountId,
    })

    expect(resolved.kind).toBe("unavailable")
  })
})
