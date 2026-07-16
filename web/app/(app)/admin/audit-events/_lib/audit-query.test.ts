import { describe, expect, test } from "vite-plus/test"
import {
  buildAuditEventsHref,
  parseAuditExportSearchParams,
  parseAuditListSearchParams,
} from "@/app/(app)/admin/audit-events/_lib/audit-query"

describe("parseAuditListSearchParams", () => {
  test("normalizes empty form values and defaults the limit to fifty", () => {
    expect(
      parseAuditListSearchParams({
        actor_account_id: "",
        action: "",
        target_type: "",
        target_id: "",
        outcome: "",
        from: "",
        to: "",
        limit: "",
        cursor: "",
      }),
    ).toEqual({ ok: true, query: { limit: "50" } })
  })

  test("accepts the complete canonical query without interpreting the opaque cursor", () => {
    const query = {
      actor_account_id: "-41",
      action: "legacy.action",
      target_type: "legacy_target",
      target_id: "target/value",
      outcome: "denied",
      from: "2026-01-01T09:00:00+09:00",
      to: "2026-02-01T09:00:00+09:00",
      limit: "1",
      cursor: "opaque+/=cursor",
    }

    expect(parseAuditListSearchParams(query)).toEqual({ ok: true, query })
  })

  test.each([
    { unknown: "1" },
    { action: ["one", "two"] },
    { actor_account_id: " 1" },
    { actor_account_id: "+1" },
    { actor_account_id: "1.0" },
    { actor_account_id: "1e2" },
    { actor_account_id: "9007199254740992" },
    { action: "a".repeat(201) },
    { target_type: "t".repeat(201) },
    { target_id: "i".repeat(513) },
    { outcome: "unknown" },
    { from: "2026-01-01T00:00:00" },
    { from: "2026-01-01T00:00:00.000Z" },
    { from: "2026-02-30T00:00:00Z" },
    { from: "2026-01-02T00:00:00Z", to: "2026-01-01T00:00:00Z" },
    { from: "2026-01-01T00:00:00Z", to: "2026-01-01T00:00:00Z" },
    { limit: "0" },
    { limit: "51" },
    { limit: "01" },
    { cursor: "c".repeat(257) },
  ])("rejects malformed or repeated input %#", (searchParams) => {
    expect(parseAuditListSearchParams(searchParams)).toEqual({ ok: false })
  })
})

describe("buildAuditEventsHref", () => {
  test("preserves normalized filters and limit while replacing the cursor once", () => {
    const href = buildAuditEventsHref(
      {
        action: "legacy action",
        target_id: "target/value?x=1",
        outcome: "failed",
        limit: "25",
        cursor: "old",
      },
      "next+/=cursor",
    )
    const url = new URL(href, "https://example.test")

    expect(url.pathname).toBe("/admin/audit-events")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "legacy action",
      target_id: "target/value?x=1",
      outcome: "failed",
      limit: "25",
      cursor: "next+/=cursor",
    })
    expect(url.searchParams.getAll("cursor")).toHaveLength(1)
    expect(url.searchParams.has("direction")).toBe(false)
    expect(url.searchParams.has("page")).toBe(false)
    expect(url.searchParams.has("offset")).toBe(false)
  })

  test("removes only the cursor when returning to the first page", () => {
    expect(
      buildAuditEventsHref({ action: "legacy.action", limit: "50", cursor: "old" }, null),
    ).toBe("/admin/audit-events?action=legacy.action&limit=50")
  })
})

describe("parseAuditExportSearchParams", () => {
  test("accepts an exact thirty-one day range and converts the actor to a number", () => {
    expect(
      parseAuditExportSearchParams({
        actor_account_id: "-41",
        action: "legacy.action",
        target_type: "legacy_target",
        target_id: "target-1",
        outcome: "succeeded",
        from: "2026-01-01T00:00:00Z",
        to: "2026-02-01T00:00:00Z",
      }),
    ).toEqual({
      ok: true,
      request: {
        actor_account_id: -41,
        action: "legacy.action",
        target_type: "legacy_target",
        target_id: "target-1",
        outcome: "succeeded",
        from: "2026-01-01T00:00:00Z",
        to: "2026-02-01T00:00:00Z",
      },
    })
  })

  test.each([
    { from: "2026-01-01T00:00:00Z" },
    { to: "2026-02-01T00:00:00Z" },
    { from: "2026-01-01T00:00:00Z", to: "2026-02-01T00:00:01Z" },
    { from: "2026-01-02T00:00:00Z", to: "2026-01-01T00:00:00Z" },
    { from: "2026-01-01T00:00:00", to: "2026-01-02T00:00:00Z" },
    { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00Z" },
    { from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z", cursor: "no" },
    { from: ["2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"], to: "2026-01-03T00:00:00Z" },
    { actor_account_id: "+1", from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" },
  ])("rejects malformed, excessive, unknown, or repeated export input %#", (input) => {
    expect(parseAuditExportSearchParams(input)).toMatchObject({ ok: false })
  })

  test("preserves URLSearchParams duplicates instead of choosing one", () => {
    const input = new URLSearchParams([
      ["from", "2026-01-01T00:00:00Z"],
      ["from", "2026-01-02T00:00:00Z"],
      ["to", "2026-01-03T00:00:00Z"],
    ])
    expect(parseAuditExportSearchParams(input)).toMatchObject({ ok: false })
  })
})
