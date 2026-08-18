import { Session } from "@/contexts/company-compatibility/domain/iam/session"
import { describe, expect, test } from "bun:test"
import type { ApiClient } from "@/api/app"
import { AuditExportRange } from "@/contexts/company-compatibility/interface/utils/audit-export-range"
import { AuditListQuery } from "@/contexts/company-compatibility/interface/utils/audit-list-query"
import { hashAuditFilters } from "@/contexts/company-compatibility/interface/utils/hash-audit-filters"
import { parseAuditEventId } from "@/contexts/company-compatibility/interface/utils/parse-audit-event-id"
import { resolveAuditNow } from "@/contexts/company-compatibility/interface/utils/resolve-audit-now"
import { toAuditIsoString } from "@/contexts/company-compatibility/interface/utils/to-audit-iso-string"
import { AuditTrail } from "@/contexts/company-compatibility/interface/utils/audit-trail"
import type { AuditEventFilters } from "@/contexts/company-compatibility/infrastructure/company/audit/audit-event-repository"
import { createTestContext } from "@/api/test/support/create-test-context"
import type { AppAuditEventDetail, AppAuditEventPage } from "@/lib/app-schemas"
import { ApplicationError } from "@/lib/errors"
import type { InferRequestType, InferResponseType } from "hono/client"

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <Value>() => Value extends Left ? 1 : 2
      ? true
      : false
    : false
type Assert<Value extends true> = Value

type ExpectedAuditListInput = {
  query?: {
    actor_account_id?: string
    action?: string
    target_type?: string
    target_id?: string
    outcome?: "succeeded" | "denied" | "failed"
    from?: string
    to?: string
    limit?: string
    cursor?: string
  }
}

type ExpectedAuditExportInput = {
  json: {
    actor_account_id?: number
    action?: string
    target_type?: string
    target_id?: string
    outcome?: "succeeded" | "denied" | "failed"
    from: string
    to: string
  }
}

type AuditListInputContract = Assert<
  Equal<InferRequestType<ApiClient["audit-events"]["$get"]>, ExpectedAuditListInput>
>
type AuditDetailInputContract = Assert<
  Equal<
    InferRequestType<ApiClient["audit-events"][":eventId"]["$get"]>,
    { param: { eventId: string } }
  >
>
type AuditExportInputContract = Assert<
  Equal<InferRequestType<ApiClient["audit-event-exports"]["$post"]>, ExpectedAuditExportInput>
>
type AuditListOutputContract = Assert<
  Equal<InferResponseType<ApiClient["audit-events"]["$get"], 200>, AppAuditEventPage>
>
type AuditDetailOutputContract = Assert<
  Equal<InferResponseType<ApiClient["audit-events"][":eventId"]["$get"], 200>, AppAuditEventDetail>
>
type AuditExportOutputContract = Assert<
  Equal<InferResponseType<ApiClient["audit-event-exports"]["$post"], 200>, string>
>

function assertAuditRpcArguments(client: ApiClient): void {
  void client["audit-events"].$get()
  void client["audit-events"].$get({ query: { limit: "50" } })
  void client["audit-events"][":eventId"].$get({ param: { eventId: "legacy-1" } })
  void client["audit-event-exports"].$post({
    json: { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" },
  })

  // @ts-expect-error Detail RPC calls require the canonical path parameter.
  void client["audit-events"][":eventId"].$get()
  // @ts-expect-error Export RPC calls require both range endpoints.
  void client["audit-event-exports"].$post({ json: {} })
}

type AuditRpcContracts = [
  AuditListInputContract,
  AuditDetailInputContract,
  AuditExportInputContract,
  AuditListOutputContract,
  AuditDetailOutputContract,
  AuditExportOutputContract,
]

function codeOf(run: () => unknown): string | undefined {
  try {
    run()
  } catch (error) {
    return error instanceof ApplicationError ? error.code : undefined
  }
}

describe("audit HTTP contract", () => {
  test("keeps the generated RPC input and successful output contract", () => {
    const contracts: AuditRpcContracts = [true, true, true, true, true, true]

    expect(contracts.every(Boolean)).toBe(true)
    expect(typeof assertAuditRpcArguments).toBe("function")
  })

  test("accepts exact-second Z and offset instants and normalizes the same instant", () => {
    const zulu = AuditListQuery.parse(
      "https://example.test/audit-events?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z",
    )
    const offset = AuditListQuery.parse(
      "https://example.test/audit-events?from=2026-01-01T09:00:00%2B09:00&to=2026-01-02T09:00:00%2B09:00",
    )

    expect(zulu.filters).toEqual(offset.filters)
    expect(zulu.filters).toMatchObject({
      fromEpoch: 1_767_225_600,
      toEpoch: 1_767_312_000,
    })
  })

  test.each([
    "2026-01-01T00:00:00.000Z",
    "2026-02-30T00:00:00Z",
    "2026-01-01T00:00:00",
    "2026-01-01T00:00:00+24:00",
    "2026-01-01T00:00:00+09:60",
  ])("rejects an invalid exact-second instant: %s", (value) => {
    expect(
      codeOf(() => AuditListQuery.parse(`https://example.test/audit-events?from=${value}`)),
    ).toBe("audit_invalid_query")
  })

  test("keeps list time filters half-open and permits either endpoint alone", () => {
    expect(
      AuditListQuery.parse("https://example.test/audit-events?from=2026-01-01T00:00:00Z").filters,
    ).toEqual({ fromEpoch: 1_767_225_600 })
    expect(
      AuditListQuery.parse("https://example.test/audit-events?to=2026-01-02T00:00:00Z").filters,
    ).toEqual({ toEpoch: 1_767_312_000 })

    for (const query of [
      "from=2026-01-01T00:00:00Z&to=2026-01-01T00:00:00Z",
      "from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z",
    ]) {
      expect(codeOf(() => AuditListQuery.parse(`https://example.test/audit-events?${query}`))).toBe(
        "audit_invalid_query",
      )
    }
  })

  test("accepts an exact 31-day export and rejects one second more", () => {
    expect(
      AuditExportRange.parse({
        from: "2026-01-01T00:00:00Z",
        to: "2026-02-01T00:00:00Z",
      }).filters,
    ).toEqual({ fromEpoch: 1_767_225_600, toEpoch: 1_769_904_000 })

    expect(
      codeOf(() =>
        AuditExportRange.parse({
          from: "2026-01-01T00:00:00Z",
          to: "2026-02-01T00:00:01Z",
        }),
      ),
    ).toBe("audit_invalid_export_range")
  })

  test.each([
    ["", 50],
    ["?limit=1", 1],
    ["?limit=100", 100],
  ])("parses canonical list limit %s", (suffix, expected) => {
    expect(AuditListQuery.parse(`https://example.test/audit-events${suffix}`).limit).toBe(expected)
  })

  test.each(["0", "101", "1.0", "1e2", "%201", "+1", "01"])(
    "rejects a non-canonical list limit: %s",
    (limit) => {
      expect(
        codeOf(() => AuditListQuery.parse(`https://example.test/audit-events?limit=${limit}`)),
      ).toBe("audit_invalid_query")
    },
  )

  test.each([
    ["0", 0],
    ["-41", -41],
    ["41", 41],
  ])("accepts a signed safe actor account ID: %s", (value, expected) => {
    expect(
      AuditListQuery.parse(`https://example.test/audit-events?actor_account_id=${value}`).filters
        .actorAccountId,
    ).toBe(expected)
  })

  test.each(["9007199254740992", "1.0", "1e3", "%201", "+1", "01", "-0"])(
    "rejects a non-canonical actor account ID: %s",
    (value) => {
      expect(
        codeOf(() =>
          AuditListQuery.parse(`https://example.test/audit-events?actor_account_id=${value}`),
        ),
      ).toBe("audit_invalid_query")
    },
  )

  test("rejects unknown, repeated, directional and overlong query values", () => {
    const overAction = "a".repeat(201)
    const overTargetId = "t".repeat(513)
    const cases = [
      "unknown=1",
      "=x",
      "limit=1&limit=2",
      "limit=1&limit=1",
      "%6cimit=1&limit=1",
      "limit",
      "direction=next",
      "action=",
      `action=${overAction}`,
      `target_id=${overTargetId}`,
      `cursor=${"c".repeat(257)}`,
    ]

    for (const query of cases) {
      expect(codeOf(() => AuditListQuery.parse(`https://example.test/audit-events?${query}`))).toBe(
        "audit_invalid_query",
      )
    }
  })

  test("uses the exact canonical event ID forms", () => {
    const uuid = "12345678-1234-4abc-8def-1234567890ab"

    expect(parseAuditEventId(uuid)).toBe(uuid)
    expect(parseAuditEventId("legacy-41")).toBe("legacy-41")
    expect(parseAuditEventId("legacy--41")).toBe("legacy--41")

    for (const value of [
      uuid.toUpperCase(),
      uuid.replaceAll("-", ""),
      "legacy-041",
      "legacy--0",
      "legacy-",
      "x".repeat(65),
    ]) {
      expect(codeOf(() => parseAuditEventId(value))).toBe("audit_event_not_found")
    }
  })

  test("hashes only normalized filters with a full lowercase SHA-256", async () => {
    const zulu: AuditEventFilters = {
      actorAccountId: -41,
      action: "legacy.action",
      targetType: "legacy_target",
      targetId: "private-target",
      outcome: "succeeded",
      fromEpoch: 1_767_225_600,
      toEpoch: 1_767_312_000,
    }
    const sameInstant = AuditListQuery.parse(
      "https://example.test/audit-events?actor_account_id=-41&action=legacy.action&target_type=legacy_target&target_id=private-target&outcome=succeeded&from=2026-01-01T09:00:00%2B09:00&to=2026-01-02T09:00:00%2B09:00&limit=1&cursor=opaque",
    ).filters
    const [first, second, changed] = await Promise.all([
      hashAuditFilters(zulu),
      hashAuditFilters(sameInstant),
      hashAuditFilters({ ...zulu, targetId: "different" }),
    ])

    expect(first).toBe(second)
    expect(first).not.toBe(changed)
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(first).not.toHaveLength(22)
  })

  test("converts safe epochs to UTC milliseconds and rejects an unrepresentable epoch", () => {
    expect(toAuditIsoString(1_767_225_600)).toBe("2026-01-01T00:00:00.000Z")
    expect(codeOf(() => toAuditIsoString(Number.MAX_SAFE_INTEGER))).toBe("audit_unavailable")
  })

  test("uses an injected NOW or a finite real-time fallback and fails closed", () => {
    expect(resolveAuditNow("2026-01-01T00:00:00.000Z").toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    )
    expect(Number.isFinite(resolveAuditNow(undefined).getTime())).toBe(true)
    expect(codeOf(() => resolveAuditNow("not-a-date"))).toBe("audit_unavailable")
  })

  test("normalizes event-generation validation failures to audit_unavailable", async () => {
    const { context } = createTestContext()
    context.var.session = new Session({
      accountId: 1,
      employeeId: 1,
      employeeStatus: "active",
      permissions: new Set(["audit:read"]),
      roleKeys: ["reader"],
    })
    context.var.auditContext = { ...context.var.auditContext, requestId: "not-a-uuid" }

    const error = await new AuditTrail(context)
      .appendSearchSucceeded({}, 50, 0)
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApplicationError)
    expect((error as ApplicationError).code).toBe("audit_unavailable")
  })
})
