import { describe, expect, test } from "bun:test"
import { PayloadTooLargeError } from "@/lib/errors"
import { AUDIT_CSV_MAX_BYTES, toAuditCsv } from "@/lib/audit/audit-csv"
import type { AuditEventDetail } from "@/domain/audit/audit-event"

function detail(overrides: Partial<AuditEventDetail> = {}): AuditEventDetail {
  return {
    eventId: "event-1",
    requestId: "request-1",
    actorAccountId: 7,
    actorEmployeeId: 11,
    action: "legacy.unknown.action",
    targetType: "legacy_target",
    targetId: "target-1",
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    clientIp: "192.0.2.1",
    clientName: "api",
    createdAt: 1_700_000_000,
    ...overrides,
  }
}

describe("audit CSV", () => {
  test("renders zero rows as the header and its trailing CRLF only", () => {
    expect(toAuditCsv([])).toBe(
      "event_id,request_id,actor_account_id,actor_employee_id,action,target_type,target_id,outcome,reason_code,authorization_json,before_json,after_json,metadata_json,client_ip,client_name,created_at\r\n",
    )
  })

  test("uses the exact fixed column order, CRLF, no BOM, and an ISO timestamp", () => {
    const csv = toAuditCsv([detail()])

    expect(csv.startsWith("\uFEFF")).toBe(false)
    expect(csv).toStartWith(
      "event_id,request_id,actor_account_id,actor_employee_id,action,target_type,target_id,outcome,reason_code,authorization_json,before_json,after_json,metadata_json,client_ip,client_name,created_at\r\n",
    )
    expect(csv).toEndWith("2023-11-14T22:13:20.000Z\r\n")
  })

  test("renders null as empty and preserves Japanese and emoji", () => {
    const csv = toAuditCsv([
      detail({
        actorAccountId: null,
        actorEmployeeId: null,
        targetType: null,
        targetId: null,
        action: "監査.検索.完了🔐",
        clientIp: null,
      }),
    ])

    expect(csv).toContain("request-1,,,監査.検索.完了🔐,,,succeeded,")
  })

  test("escapes comma, quote, CR, and LF using RFC 4180", () => {
    const csv = toAuditCsv([
      detail({
        action: 'legacy,"quoted"\r\nline',
        metadataJson: '{"value":"a,b"}',
      }),
    ])

    expect(csv).toContain('"legacy,""quoted""\r\nline"')
    expect(csv).toContain('"{""value"":""a,b""}"')
  })

  test.each(["=CMD()", "+SUM(1)", "-2+3", "@A1", "  =CMD()", "\t+SUM(1)", "\r-2", "\n@A1"])(
    "neutralizes formula-capable value %j before escaping",
    (value) => {
      const csv = toAuditCsv([detail({ action: value })])
      const expected = value.includes("\r") || value.includes("\n") ? `"'${value}"` : `'${value}`

      expect(csv).toContain(expected)
    },
  )

  test("keeps a legacy negative target identifier as text", () => {
    expect(toAuditCsv([detail({ targetId: "legacy--1" })])).toContain(",legacy--1,")
  })

  test("accepts exactly sixteen MiB and rejects one byte more", () => {
    const base = toAuditCsv([detail({ metadataJson: "" })])
    const exactValueLength = AUDIT_CSV_MAX_BYTES - new TextEncoder().encode(base).byteLength

    expect(
      new TextEncoder().encode(toAuditCsv([detail({ metadataJson: "x".repeat(exactValueLength) })]))
        .byteLength,
    ).toBe(AUDIT_CSV_MAX_BYTES)

    try {
      toAuditCsv([detail({ metadataJson: "x".repeat(exactValueLength + 1) })])
      throw new Error("expected CSV byte limit rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadTooLargeError)
      expect((error as PayloadTooLargeError).code).toBe("audit_export_too_large")
    }
  })
})
